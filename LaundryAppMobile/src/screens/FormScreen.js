import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal as RNModal, Image, Alert, FlatList } from 'react-native';
import { Text, Surface, IconButton, Button, List, Divider, Portal, Dialog, Paragraph, Snackbar, TextInput } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { laundryCategories } from '../data/categories';
import { db, auth, firestore } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ref, push, set, get } from 'firebase/database';
import { MaterialIcons } from '@expo/vector-icons';
import InvoiceModal from '../components/InvoiceModal';
import * as ImagePicker from 'expo-image-picker';

const IMGBB_API_KEY = 'e6c2724ff8344c073410da4876c3d35f';

const MemoizedItemRow = memo(({ item, catId, handleQtyChange, styles }) => {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge" style={{ fontWeight: '600', color: '#202124' }}>{item.name}</Text>
        <Text variant="bodyMedium" style={{ color: '#1A73E8', marginTop: 4, fontWeight: 'bold' }}>{item.priceFormat}</Text>
      </View>
      <View style={styles.qtyControl}>
        <IconButton 
          icon="minus" 
          mode="contained" 
          containerColor={item.qty === 0 ? '#F1F3F4' : '#E8F0FE'}
          iconColor={item.qty === 0 ? '#C4C7CC' : '#1A73E8'}
          size={18} 
          onPress={() => handleQtyChange(catId, item.id, -1)} 
          disabled={item.qty === 0}
        />
        <Text style={styles.qtyText}>{item.qty}</Text>
        <IconButton 
          icon="plus" 
          mode="contained" 
          containerColor="#1A73E8"
          iconColor="#fff"
          size={18} 
          onPress={() => handleQtyChange(catId, item.id, 1)} 
        />
      </View>
    </View>
  );
});

const FormScreen = ({ navigation, route }) => {
  const existingOrder = route.params?.orderData;

  const [categories, setCategories] = useState(() => {
    const defaultCats = JSON.parse(JSON.stringify(laundryCategories));
    if (existingOrder && existingOrder.items) {
      existingOrder.items.forEach(existingItem => {
        defaultCats.forEach(cat => {
          const item = cat.items.find(i => i.id === existingItem.id);
          if (item) {
            item.qty = existingItem.qty;
          }
        });
      });
    }
    return defaultCats;
  });

  const [saving, setSaving] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [previewOrder, setPreviewOrder] = useState(null);
  
  // Dialog State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', message: '', onConfirm: null, isError: false });
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(existingOrder?.promoCode || null);

  // Photo capture
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  const [availablePromos, setAvailablePromos] = useState([]);
  const [usedPromos, setUsedPromos] = useState({});
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [cancelPenalty, setCancelPenalty] = useState(0);

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        let used = {};
        if (auth.currentUser) {
          const uid = auth.currentUser.uid;
          const usedRef = ref(db, `users/${uid}/usedPromos`);
          const snapshot = await get(usedRef);
          if (snapshot.exists()) {
            used = snapshot.val();
            setUsedPromos(used);
          }

          // Kiểm tra án phạt hủy đơn
          const penaltyRef = ref(db, `users/${uid}/cancelPenalty`);
          const penaltySnap = await get(penaltyRef);
          if (penaltySnap.exists()) {
            setCancelPenalty(penaltySnap.val());
          }
        }

        const querySnapshot = await getDocs(collection(firestore, 'laundry_promos'));
        const promos = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.target_uid || data.target_uid === auth.currentUser?.uid) {
            if (!used[data.code]) {
              promos.push({ id: doc.id, ...data });
            }
          }
        });
        setAvailablePromos(promos);
      } catch (error) {
        console.log("Error fetching promos:", error);
      } finally {
        setLoadingPromos(false);
      }
    };
    fetchPromos();
  }, []);

  const calculateSubtotal = () => {
    let total = 0;
    categories.forEach(cat => {
      cat.items.forEach(item => {
        total += item.price * item.qty;
      });
    });
    return total;
  };

  const subtotal = calculateSubtotal();
  const appliedPromoData = availablePromos.find(p => p.code === appliedPromo);
  let discount = 0;
  if (appliedPromoData) {
    if (appliedPromoData.discountPercent) {
      discount = subtotal * (appliedPromoData.discountPercent / 100);
    } else if (appliedPromoData.discountAmount) {
      discount = appliedPromoData.discountAmount;
    }
    // Handle max discount if any
    if (appliedPromoData.maxDiscount && discount > appliedPromoData.maxDiscount) {
      discount = appliedPromoData.maxDiscount;
    }
  } else if (appliedPromo === 'KHAITRUONG') {
    // Fallback for existing orders that have the hardcoded promo
    discount = subtotal * 0.5;
  }
  const totalAmount = Math.max(0, subtotal - discount);

  // Phụ phí bù đủ 50k cho đơn nhỏ
  const MIN_ORDER = 50000;
  let surcharge = 0;
  let feeWater = 0;
  let feeSoap = 0;
  let feeLabor = 0;
  if (totalAmount > 0 && totalAmount < MIN_ORDER) {
    surcharge = MIN_ORDER - totalAmount;
    // Chia đều phí ra 3 loại
    feeWater = Math.ceil(surcharge / 3);
    feeSoap = Math.ceil(surcharge / 3);
    feeLabor = surcharge - feeWater - feeSoap;
  }
  const finalTotal = totalAmount > 0 ? totalAmount + surcharge + cancelPenalty : 0;

  const handleQtyChange = useCallback((catId, itemId, delta) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.map(item => {
            if (item.id === itemId) {
              const newQty = Math.max(0, item.qty + delta);
              return { ...item, qty: newQty };
            }
            return item;
          })
        };
      }
      return cat;
    }));
  }, []);

  const getSelectedItems = () => {
    const selected = [];
    categories.forEach(cat => {
      cat.items.forEach(item => {
        if (item.qty > 0) {
          selected.push({ ...item });
        }
      });
    });
    return selected;
  };

  const saveOrder = async (status) => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      setDialogContent({
        title: 'Lỗi',
        message: 'Vui lòng chọn ít nhất 1 món đồ để giặt!',
        isError: true,
        onConfirm: null
      });
      setDialogVisible(true);
      return;
    }

    if (status === 'pending') {
      // Hiện modal chụp ảnh trước
      setPhotoModalVisible(true);
    } else {
      proceedSaveOrder(status);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setDialogContent({
        title: 'Quyền truy cập',
        message: 'Cần cho phép truy cập camera để chụp ảnh vị trí bỏ đồ!',
        isError: true,
        onConfirm: null
      });
      setDialogVisible(true);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setCapturedPhoto(result.assets[0]);
    }
  };

  const handleConfirmPhoto = async () => {
    if (!capturedPhoto) return;
    setSaving(true);
    
    try {
      // Upload lên ImgBB
      const formData = new FormData();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', capturedPhoto.base64);

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      let photoUrl = null;
      if (data.success) {
        photoUrl = data.data.url;
      }

      setPhotoModalVisible(false);

      // Tạo preview order với photo URL
      const selectedItems = getSelectedItems();
      const timestamp = new Date().getTime();
      const orderId = existingOrder ? existingOrder.id : 'ORD-' + Math.floor(1000 + Math.random() * 9000);

      const tempOrder = {
        id: orderId,
        uid: auth.currentUser?.uid || 'anonymous',
        items: selectedItems,
        subtotal: subtotal,
        discount: discount,
        promoCode: appliedPromo,
        surcharge: surcharge,
        feeWater: feeWater,
        feeSoap: feeSoap,
        feeLabor: feeLabor,
        cancelPenalty: cancelPenalty,
        total: finalTotal,
        status: 'draft',
        timestamp: timestamp,
        photoUrl: photoUrl,
      };
      setPreviewOrder(tempOrder);
    } catch (error) {
      console.log('Upload error:', error);
      setDialogContent({
        title: 'Lỗi tải ảnh',
        message: 'Không thể tải ảnh lên, vui lòng thử lại!',
        isError: true,
        onConfirm: null
      });
      setDialogVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const proceedSaveOrder = async (status) => {
    setSaving(true);
    const selectedItems = getSelectedItems();
    const timestamp = existingOrder ? existingOrder.timestamp : Date.now();
    const orderId = existingOrder ? existingOrder.id : timestamp.toString().slice(-6);

    let finalStatus = status;
    if (status === 'pending' && totalAmount === 0) {
      finalStatus = 'awaiting_wash';
    }

    const orderData = {
      id: orderId,
      uid: auth.currentUser?.uid || 'anonymous',
      items: selectedItems,
      subtotal: subtotal,
      discount: discount,
      promoCode: appliedPromo,
      surcharge: surcharge,
      feeWater: feeWater,
      feeSoap: feeSoap,
      feeLabor: feeLabor,
      cancelPenalty: cancelPenalty,
      total: finalTotal,
      status: finalStatus,
      timestamp: timestamp,
      photoUrl: previewOrder?.photoUrl || null,
    };

    try {
      if (status !== 'draft') {
        // Push to Firebase
        const newOrderRef = push(ref(db, 'laundry_orders'));
        orderData.firebaseKey = newOrderRef.key;
        await set(newOrderRef, orderData);

        // Mark promo as used
        if (appliedPromo && auth.currentUser) {
          const usedPromoRef = ref(db, `users/${auth.currentUser.uid}/usedPromos/${appliedPromo}`);
          await set(usedPromoRef, true);
        }

        // Xóa khỏi draft local nếu đang sửa đơn nháp
        if (existingOrder && existingOrder.status === 'draft') {
          const dataStr = await AsyncStorage.getItem('saved_invoices_mobile');
          if (dataStr) {
            let allData = JSON.parse(dataStr);
            allData = allData.filter(o => o.id !== existingOrder.id);
            await AsyncStorage.setItem('saved_invoices_mobile', JSON.stringify(allData));
          }
        }

        // Xóa án phạt hủy đơn sau khi đặt đơn mới thành công
        if (cancelPenalty > 0 && auth.currentUser) {
          const uid = auth.currentUser.uid;
          await set(ref(db, `users/${uid}/cancelPenalty`), 0);
          await set(ref(db, `users/${uid}/cancelCount`), 0);
          setCancelPenalty(0);
        }
      }

      // Save locally
      const storedData = await AsyncStorage.getItem('saved_invoices_mobile');
      let history = storedData ? JSON.parse(storedData) : [];
      if (existingOrder) {
        history = history.filter(o => o.id !== existingOrder.id);
      }
      history.unshift(orderData);
      await AsyncStorage.setItem('saved_invoices_mobile', JSON.stringify(history));

      setCreatedOrder(orderData);
    } catch (err) {
      setDialogContent({
        title: 'Lỗi',
        message: 'Có lỗi xảy ra: ' + err.message,
        isError: true,
        onConfirm: null
      });
      setDialogVisible(true);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseInvoice = () => {
    if (previewOrder) {
      setPreviewOrder(null);
    } else {
      setCreatedOrder(null);
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" iconColor="#000" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.title}>Tạo Đơn Mới</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlatList
        data={categories}
        keyExtractor={cat => cat.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        renderItem={({ item: cat }) => (
          <Surface key={cat.id} style={styles.categoryCard} elevation={1}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryIcon}>
                <IconButton icon={cat.icon} iconColor="#1A73E8" size={24} />
              </View>
              <Text variant="titleMedium" style={styles.categoryTitle}>{cat.title}</Text>
            </View>
            <View style={styles.itemsContainer}>
              {cat.items.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && <Divider style={{ marginVertical: 8 }} />}
                  <MemoizedItemRow 
                    item={item} 
                    catId={cat.id} 
                    handleQtyChange={handleQtyChange} 
                    styles={styles} 
                  />
                </View>
              ))}
            </View>
          </Surface>
        )}
      />

      <Surface style={styles.bottomBar} elevation={8}>
        <TouchableOpacity onPress={() => setPromoModalVisible(true)} style={[styles.promoRow, appliedPromo && styles.promoRowApplied]} activeOpacity={0.8}>
          {appliedPromo && appliedPromoData ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ backgroundColor: '#E91E63', padding: 10, borderRadius: 12, marginRight: 12 }}>
                <MaterialIcons name={appliedPromoData.icon || "loyalty"} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#E91E63', fontWeight: '700', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Đã áp dụng mã</Text>
                <Text style={{ fontSize: 16, color: '#C2185B', fontWeight: '900' }}>{appliedPromoData.code}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#F8BBD0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#E91E63', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#E91E63', marginRight: 4 }}>
                    Thay đổi
                  </Text>
                  <MaterialIcons name="swap-horiz" size={16} color="#E91E63" />
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#E8F0FE', padding: 10, borderRadius: 12, marginRight: 12 }}>
                  <MaterialIcons name="local-offer" size={22} color="#1A73E8" />
                </View>
                <Text style={{ fontSize: 16, color: '#202124', fontWeight: 'bold' }}>Mã ưu đãi</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#F1F3F4' }}>
                <Text style={{ fontSize: 14, color: '#1A73E8', fontWeight: '700', marginRight: 6 }}>
                  Chọn mã
                </Text>
                <MaterialIcons name="arrow-forward-ios" size={12} color="#1A73E8" />
              </View>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.totalRow}>
          {totalAmount > 0 && (
            <View style={{ marginBottom: 12, width: '100%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: '#5F6368' }}>Tạm tính đồ giặt</Text>
                <Text style={{ fontSize: 13, color: '#202124' }}>{totalAmount.toLocaleString('vi-VN')} đ</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: surcharge > 0 ? '#E65100' : '#1E8E3E' }}>• Tiền nước</Text>
                <Text style={{ fontSize: 13, color: surcharge > 0 ? '#E65100' : '#1E8E3E', fontWeight: surcharge === 0 ? '700' : '400' }}>
                  {surcharge > 0 ? `+${feeWater.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: surcharge > 0 ? '#E65100' : '#1E8E3E' }}>• Tiền xà bông</Text>
                <Text style={{ fontSize: 13, color: surcharge > 0 ? '#E65100' : '#1E8E3E', fontWeight: surcharge === 0 ? '700' : '400' }}>
                  {surcharge > 0 ? `+${feeSoap.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, color: surcharge > 0 ? '#E65100' : '#1E8E3E' }}>• Tiền công</Text>
                <Text style={{ fontSize: 13, color: surcharge > 0 ? '#E65100' : '#1E8E3E', fontWeight: surcharge === 0 ? '700' : '400' }}>
                  {surcharge > 0 ? `+${feeLabor.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                </Text>
              </View>
              {cancelPenalty > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: '#D32F2F', fontWeight: '600' }}>• Phí phạt hủy đơn</Text>
                  <Text style={{ fontSize: 13, color: '#D32F2F', fontWeight: '700' }}>+{cancelPenalty.toLocaleString('vi-VN')} đ</Text>
                </View>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: '#E8EAED', marginTop: 4, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="titleMedium" style={{ color: '#5F6368', fontWeight: 'bold' }}>Tổng thanh toán:</Text>
                <Text variant="headlineSmall" style={{ color: (surcharge > 0 || cancelPenalty > 0) ? '#E65100' : '#1A73E8', fontWeight: '900' }}>
                  {finalTotal.toLocaleString('vi-VN')} đ
                </Text>
              </View>
            </View>
          )}
          {totalAmount === 0 && (
            <>
              <Text variant="titleMedium" style={{ color: '#5F6368', fontWeight: 'bold' }}>Tổng thanh toán:</Text>
              <Text variant="headlineSmall" style={{ color: '#1A73E8', fontWeight: '900' }}>
                0 đ
              </Text>
            </>
          )}
        </View>
        <View style={styles.actionButtons}>
          <Button 
            mode="outlined" 
            icon="bookmark-outline" 
            style={styles.btnDraft} 
            textColor="#5F6368"
            onPress={() => saveOrder('draft')}
            disabled={saving}
          >
            Lưu Tạm
          </Button>
          <Button 
            mode="contained" 
            icon="check-circle" 
            style={styles.btnSchedule} 
            contentStyle={{ height: 48 }}
            onPress={() => saveOrder('pending')}
            loading={saving}
            disabled={subtotal === 0 || saving}
          >
            Đặt Lịch Ngay
          </Button>
        </View>
      </Surface>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ borderRadius: 16, backgroundColor: '#fff' }}>
          <Dialog.Title style={{ color: dialogContent.isError ? '#D32F2F' : '#1A73E8', fontWeight: 'bold' }}>
            {dialogContent.title}
          </Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: '#5F6368', fontSize: 16 }}>{dialogContent.message}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            {dialogContent.onConfirm ? (
              <>
                <Button onPress={() => setDialogVisible(false)} textColor="#5F6368">Hủy</Button>
                <Button onPress={dialogContent.onConfirm} mode="contained" style={{ borderRadius: 8, paddingHorizontal: 16 }}>Đồng ý</Button>
              </>
            ) : (
              <Button onPress={() => setDialogVisible(false)} mode="contained" style={{ borderRadius: 8, paddingHorizontal: 16 }}>Đóng</Button>
            )}
          </Dialog.Actions>
        </Dialog>

        <RNModal visible={promoModalVisible} animationType="slide" transparent={true} onRequestClose={() => setPromoModalVisible(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setPromoModalVisible(false)} activeOpacity={1} />
            <View style={{ backgroundColor: '#F8F9FA', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: '80%' }}>
              <View style={{ backgroundColor: '#fff', paddingVertical: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 1, borderBottomColor: '#F1F3F4', alignItems: 'center' }}>
            <View style={{ width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3, marginBottom: 12 }} />
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#202124', textAlign: 'center' }}>Ưu Đãi Của Bạn</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20 }}>
            {loadingPromos ? (
              <Text style={{ textAlign: 'center', marginVertical: 20, color: '#5F6368' }}>Đang tải ưu đãi...</Text>
            ) : availablePromos.length === 0 ? (
              <Text style={{ textAlign: 'center', marginVertical: 20, color: '#5F6368' }}>Không có ưu đãi nào</Text>
            ) : (
              availablePromos.map((promo, idx) => {
                const isSelected = appliedPromo === promo.code;
                
                let isExpired = false;
                if (promo.expiryDate) {
                  const expDate = promo.expiryDate.toDate ? promo.expiryDate.toDate() : new Date(promo.expiryDate);
                  if (expDate < new Date()) {
                    isExpired = true;
                  }
                }
                
                const isUsed = usedPromos[promo.code] === true;
                const notEnoughSubtotal = promo.minOrderAmount && subtotal < promo.minOrderAmount;
                const isDisabled = isExpired || isUsed || notEnoughSubtotal;

                return (
                  <TouchableOpacity key={idx} onPress={() => {
                    if (isDisabled) {
                      if (notEnoughSubtotal) {
                        Alert.alert(
                          'Chưa đủ điều kiện',
                          `Đơn hàng phải từ ${promo.minOrderAmount.toLocaleString('vi-VN')} đ để áp dụng mã này.`
                        );
                      }
                      return;
                    }
                    if (isSelected) {
                      setAppliedPromo(null);
                    } else {
                      setAppliedPromo(promo.code);
                      setPromoModalVisible(false);
                    }
                  }} activeOpacity={isDisabled ? 1 : 0.8} style={{ marginBottom: 16, opacity: isDisabled ? 0.6 : 1 }}>
                    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: isSelected ? '#E91E63' : isDisabled ? '#E0E0E0' : '#fff' }}>
                    
                    {/* Left Icon Part */}
                    <View style={{ backgroundColor: isDisabled ? '#BDBDBD' : isSelected ? '#E91E63' : '#1A73E8', width: 90, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name={notEnoughSubtotal ? "money-off" : isUsed ? "verified" : isExpired ? "event-busy" : promo.icon} size={36} color="#fff" />
                    </View>
                    
                    {/* Right Content Part */}
                    <View style={{ flex: 1, padding: 16, backgroundColor: isSelected ? '#FFF0F5' : isDisabled ? '#FAFAFA' : '#fff' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: isSelected ? '#E91E63' : isDisabled ? '#9E9E9E' : '#202124', flex: 1, textDecorationLine: isDisabled ? 'line-through' : 'none' }}>{promo.title}</Text>
                        {isSelected && <MaterialIcons name="check-circle" size={22} color="#E91E63" style={{ marginLeft: 8 }} />}
                      </View>
                      <Text style={{ fontSize: 13, color: isDisabled ? '#BDBDBD' : '#5F6368', marginTop: 6, lineHeight: 18 }}>{promo.desc}</Text>
                      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                         <View style={{ backgroundColor: isDisabled ? '#EEEEEE' : isSelected ? 'rgba(233, 30, 99, 0.1)' : 'rgba(26, 115, 232, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                           <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDisabled ? '#9E9E9E' : isSelected ? '#E91E63' : '#1A73E8' }}>Mã: {promo.code}</Text>
                         </View>
                         {notEnoughSubtotal ? (
                           <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '900', fontStyle: 'italic' }}>Từ {promo.minOrderAmount.toLocaleString('vi-VN')} đ</Text>
                         ) : isUsed ? (
                           <Text style={{ fontSize: 12, color: '#757575', fontWeight: '900', fontStyle: 'italic' }}>Đã sử dụng</Text>
                         ) : isExpired ? (
                           <Text style={{ fontSize: 12, color: '#D32F2F', fontWeight: '900', fontStyle: 'italic' }}>Đã hết hạn</Text>
                         ) : null}
                      </View>
                    </View>
                    
                    {/* Ticket Circle Cutouts */}
                    <View style={{ position: 'absolute', top: -12, left: 78, width: 24, height: 24, borderRadius: 12, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: isSelected ? '#E91E63' : isDisabled ? '#E0E0E0' : '#fff' }} />
                    <View style={{ position: 'absolute', bottom: -12, left: 78, width: 24, height: 24, borderRadius: 12, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: isSelected ? '#E91E63' : isDisabled ? '#E0E0E0' : '#fff' }} />
                  </View>
                </TouchableOpacity>
              );
            }))}
            
            </ScrollView>
          </View>
        </View>
      </RNModal>
      </Portal>

      {/* Photo Capture Modal */}
      <RNModal visible={photoModalVisible} animationType="slide" transparent={true} onRequestClose={() => setPhotoModalVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setPhotoModalVisible(false); setCapturedPhoto(null); }} activeOpacity={1} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
            <View style={{ alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F3F4' }}>
              <View style={{ width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3, marginBottom: 12 }} />
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#202124' }}>Chụp vị trí bỏ đồ</Text>
              <Text style={{ fontSize: 13, color: '#5F6368', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 }}>Chụp ảnh nơi bạn để đồ giặt để nhân viên dễ tìm và lấy nhé!</Text>
            </View>
            
            <View style={{ padding: 20, alignItems: 'center' }}>
              {capturedPhoto ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Image source={{ uri: capturedPhoto.uri }} style={{ width: '100%', height: 220, borderRadius: 16 }} resizeMode="cover" />
                  <TouchableOpacity onPress={handleTakePhoto} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialIcons name="refresh" size={18} color="#1A73E8" />
                    <Text style={{ color: '#1A73E8', fontWeight: 'bold', marginLeft: 4 }}>Chụp lại</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handleTakePhoto} style={{ width: '100%', height: 180, borderRadius: 16, borderWidth: 2, borderColor: '#E8EAED', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
                  <View style={{ backgroundColor: '#E8F0FE', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <MaterialIcons name="camera-alt" size={28} color="#1A73E8" />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#202124' }}>Bấm để chụp ảnh</Text>
                  <Text style={{ fontSize: 13, color: '#5F6368', marginTop: 4 }}>Chụp nơi bạn để đồ giặt</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', width: '100%', marginTop: 20 }}>
                <Button mode="outlined" onPress={() => { setPhotoModalVisible(false); setCapturedPhoto(null); }} style={{ flex: 0.4, borderRadius: 12, borderColor: '#E8EAED' }} textColor="#5F6368">Hủy</Button>
                <View style={{ width: 12 }} />
                <Button mode="contained" onPress={handleConfirmPhoto} style={{ flex: 0.6, borderRadius: 12 }} disabled={!capturedPhoto} icon="check-circle">Xác nhận</Button>
              </View>
            </View>
          </View>
        </View>
      </RNModal>

      <InvoiceModal 
        visible={!!createdOrder || !!previewOrder} 
        orderData={previewOrder || createdOrder} 
        onClose={handleCloseInvoice}
        onEdit={() => setPreviewOrder(null)}
        onSchedule={() => {
          setPreviewOrder(null);
          proceedSaveOrder('pending');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#202124',
  },
  content: {
    padding: 16,
    paddingBottom: 280,
  },
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIcon: {
    backgroundColor: '#E8F0FE',
    borderRadius: 16,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#202124',
    flex: 1,
    flexWrap: 'wrap',
  },
  itemsContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyText: {
    width: 32,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#202124',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  promoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F3F4',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  promoRowApplied: {
    borderColor: '#F48FB1',
    backgroundColor: '#FCE4EC',
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnDraft: {
    flex: 0.35,
    borderColor: '#D2E3FC',
    borderWidth: 2,
    borderRadius: 12,
  },
  btnSchedule: {
    flex: 0.6,
    borderRadius: 12,
  },
});

export default FormScreen;
