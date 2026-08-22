import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Image, Dimensions, FlatList } from 'react-native';
import { Text, Surface, FAB, Avatar, ProgressBar } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InvoiceModal from '../components/InvoiceModal';
import Skeleton from '../components/Skeleton';
import { db, auth } from '../services/firebase';
import { ref, onValue, off, push, set, get } from 'firebase/database';

const HomeScreen = ({ navigation }) => {
  const [history, setHistory] = useState([]);
  const [donation, setDonation] = useState(0); 
  const [baseDonation, setBaseDonation] = useState(457000); 
  const [myDonation, setMyDonation] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const bannerScrollRef = useRef(null);
  const bannerWidth = Dimensions.get('window').width - 48;

  const handleBannerScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / bannerWidth);
    
    // Nếu lướt tới ảnh thứ 3 (bản copy của ảnh 1), giật ngay về ảnh 1 thật (index 0) mà không có hiệu ứng
    if (pageIndex === 2) {
      bannerScrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  };

  useEffect(() => {
    const ordersRef = ref(db, 'laundry_orders');
    
    const unsubscribe = onValue(ordersRef, async (snapshot) => {
      try {
        const localDataStr = await AsyncStorage.getItem('saved_invoices_mobile');
        let localData = localDataStr ? JSON.parse(localDataStr) : [];
        const currentUserUid = auth.currentUser?.uid;
        
        if (snapshot.exists()) {
          const firebaseOrders = snapshot.val();
          
          // Tính tổng tiền đơn hàng HOÀN THÀNH (của mọi người dùng) và của RIÊNG user này
          let totalRevenue = 0;
          let myTotalRevenue = 0;
          Object.values(firebaseOrders).forEach(o => {
            if (o.status === 'completed') {
              totalRevenue += (o.total || 0);
              if (o.uid === currentUserUid) {
                myTotalRevenue += (o.total || 0);
              }
            }
          });
          setDonation(totalRevenue);
          setMyDonation(myTotalRevenue);
          
          // Lọc ra các đơn hàng từ Firebase thuộc về user hiện tại
          const myFirebaseOrders = Object.values(firebaseOrders).filter(o => o.uid === currentUserUid);
          
          const mergedMap = new Map();
          
          // Thêm các đơn draft từ local
          localData.forEach(localOrder => {
            if (localOrder.uid === currentUserUid && localOrder.status === 'draft') {
               mergedMap.set(localOrder.id, localOrder);
            }
          });
          
          // Ghi đè/Thêm các đơn từ Firebase
          myFirebaseOrders.forEach(fbOrder => {
             mergedMap.set(fbOrder.id, fbOrder);
          });
          
          let mergedData = Array.from(mergedMap.values());
          
          // Sắp xếp giảm dần theo thời gian
          mergedData.sort((a, b) => b.timestamp - a.timestamp);
          
          setHistory(mergedData);
          await AsyncStorage.setItem('saved_invoices_mobile', JSON.stringify(mergedData));
        } else {
          // Trọn bộ là local (khi firebase rỗng)
          const myLocalOrders = localData.filter(o => o.uid === currentUserUid);
          setHistory(myLocalOrders);
        }
      } catch (e) {
        console.log('Error syncing with Firebase', e);
      }
    });

    const donationRef = ref(db, 'laundry_config/donation');
    const donationUnsubscribe = onValue(donationRef, (snapshot) => {
      if (snapshot.exists()) {
        setBaseDonation(Number(snapshot.val()));
      }
    });

    return () => {
      off(ordersRef, 'value', unsubscribe);
      off(donationRef, 'value', donationUnsubscribe);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const dataStr = await AsyncStorage.getItem('saved_invoices_mobile');
      if (dataStr) {
        const currentUserUid = auth.currentUser?.uid;
        const allData = JSON.parse(dataStr);
        
        const uniqueMap = new Map();
        allData.forEach(order => {
          if (order.uid === currentUserUid) {
            uniqueMap.set(order.id, order);
          }
        });
        
        let uniqueData = Array.from(uniqueMap.values());
        uniqueData.sort((a, b) => b.timestamp - a.timestamp);
        
        setHistory(uniqueData);
      }
    } catch (e) {
      console.log('Error loading data', e);
    } finally {
      setLoading(false);
    }
  };



  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleScheduleOrder = async (order) => {
    try {
      const orderData = { ...order, status: 'pending', timestamp: new Date().getTime() };
      
      // Push to Firebase
      const newOrderRef = push(ref(db, 'laundry_orders'));
      orderData.firebaseKey = newOrderRef.key;
      await set(newOrderRef, orderData);

      // Đánh dấu mã đã dùng
      if (order.promoCode && auth.currentUser) {
        const usedPromoRef = ref(db, `users/${auth.currentUser.uid}/usedPromos/${order.promoCode}`);
        await set(usedPromoRef, true);
      }

      // Xóa khỏi local draft
      const dataStr = await AsyncStorage.getItem('saved_invoices_mobile');
      if (dataStr) {
        let allData = JSON.parse(dataStr);
        allData = allData.filter(o => o.id !== order.id);
        allData.unshift(orderData); // Thêm bản ghi mới
        await AsyncStorage.setItem('saved_invoices_mobile', JSON.stringify(allData));
      }

      await loadData(); // Refresh data
    } catch (error) {
      console.log('Error scheduling order', error);
    }
  };

  const handleCancelOrder = async (order, reason) => {
    try {
      if (order.firebaseKey) {
        // Cập nhật lên Firebase
        const orderRef = ref(db, `laundry_orders/${order.firebaseKey}`);
        await set(orderRef, { ...order, status: 'cancelled', cancelReason: reason, cancelledBy: 'user' });
      } else {
        // Cập nhật Local Storage nếu chưa có trên Firebase
        const dataStr = await AsyncStorage.getItem('saved_invoices_mobile');
        if (dataStr) {
          let allData = JSON.parse(dataStr);
          const index = allData.findIndex(o => o.id === order.id);
          if (index > -1) {
            allData[index].status = 'cancelled';
            allData[index].cancelReason = reason;
            allData[index].cancelledBy = 'user';
            await AsyncStorage.setItem('saved_invoices_mobile', JSON.stringify(allData));
          }
        }
      }

      // Đếm số lần hủy đơn và áp phạt nếu > 3
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        const cancelCountRef = ref(db, `users/${uid}/cancelCount`);
        const snap = await get(cancelCountRef);
        const currentCount = snap.exists() ? snap.val() : 0;
        const newCount = currentCount + 1;
        await set(cancelCountRef, newCount);

        // Nếu hủy quá 3 lần => áp phạt phụ phí 10k cho đơn tiếp theo
        if (newCount >= 3) {
          const penaltyRef = ref(db, `users/${uid}/cancelPenalty`);
          await set(penaltyRef, 10000);
        }
      }

      setSelectedOrder(null);
      await loadData();
    } catch (error) {
      console.log('Error cancelling order', error);
    }
  };

  const awaitPayCount = history.filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length;
  const awaitWashCount = history.filter(o => o.status === 'awaiting_wash').length;
  const awaitDryCount = history.filter(o => o.status === 'awaiting_dry').length;
  const completedCount = history.filter(o => o.status === 'completed').length;


  const getStatusDisplay = (status) => {
    switch(status) {
      case 'draft': return { text: 'Lưu tạm', color: '#F9AB00' };
      case 'awaiting_payment': 
      case 'pending': return { text: 'Chờ thanh toán', color: '#D32F2F' };
      case 'awaiting_wash': return { text: 'Chờ giặt', color: '#1976D2' };
      case 'awaiting_dry': return { text: 'Chờ phơi', color: '#7B1FA2' };
      case 'completed': return { text: 'Hoàn thành', color: '#1E8E3E' };
      case 'cancelled': return { text: 'Đã hủy', color: '#C5221F' };
      default: return { text: 'Đã đặt', color: '#1A73E8' };
    }
  };

  const renderHistoryItem = (order) => {
    const dateStr = new Date(order.timestamp).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
    });

    const statusObj = getStatusDisplay(order.status);

    return (
      <TouchableOpacity key={order.id} onPress={() => setSelectedOrder(order)} activeOpacity={0.7}>
        <Surface style={styles.historyCard} elevation={2}>
          <View style={styles.historyCardContent}>
            <View style={styles.historyIconContainer}>
              <Avatar.Icon size={48} icon="basket" style={{ backgroundColor: '#F1F3F4' }} color="#1A73E8" />
            </View>
            <View style={styles.historyMain}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#202124' }}>
                Mã đơn: {order.id}
              </Text>
              <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 2, marginBottom: 8 }}>
                {dateStr}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusObj.color + '15' }]}>
                <Text style={{ color: statusObj.color, fontSize: 12, fontWeight: 'bold' }}>
                  {statusObj.text}
                </Text>
              </View>
            </View>
            <View style={styles.historyPrice}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#1A73E8' }}>
                {order.total.toLocaleString('vi-VN')} đ
              </Text>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  };

  const renderSkeletons = () => (
    <>
      {[1, 2, 3].map(key => (
        <Surface key={key} style={styles.historyCard} elevation={1}>
          <View style={styles.historyCardContent}>
            <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 16 }} />
            <View style={styles.historyMain}>
              <Skeleton width={120} height={20} style={{ marginBottom: 8 }} />
              <Skeleton width={100} height={16} style={{ marginBottom: 12 }} />
              <Skeleton width={80} height={24} borderRadius={8} />
            </View>
            <View style={styles.historyPrice}>
              <Skeleton width={90} height={20} />
            </View>
          </View>
        </Surface>
      ))}
    </>
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 11) return 'Chào buổi sáng,';
    if (hour >= 11 && hour <= 13) return 'Chào buổi trưa,';
    if (hour > 13 && hour <= 17) return 'Chào buổi chiều,';
    return 'Chào buổi tối,';
  };

  const renderHeader = useMemo(() => (
    <View>
      {/* Mục Donate Mua Điện Thoại Mới */}
      <Surface style={[styles.historyCard, { marginBottom: 20, backgroundColor: '#FFF3E0' }]} elevation={2}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#E65100', flex: 1 }}>
              Quỹ Mua Điện Thoại
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ color: '#5F6368', marginBottom: 12 }}>
            Toàn bộ doanh thu từ các đơn hàng sẽ được tích lũy vào quỹ để nhà phát triển mua cái điện thoại mới.
          </Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text variant="bodySmall" style={{ fontWeight: 'bold', color: '#E65100' }}>
              Đã góp: {(baseDonation + donation).toLocaleString('vi-VN')} đ
            </Text>
            <Text variant="bodySmall" style={{ fontWeight: 'bold', color: '#5F6368' }}>
              Mục tiêu: 6.000.000 đ
            </Text>
          </View>
          <ProgressBar 
            progress={Math.min((baseDonation + donation) / 6000000, 1)} 
            color="#FF9800" 
            style={{ height: 10, borderRadius: 5, backgroundColor: '#FFE0B2', marginBottom: 4 }} 
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Text variant="labelSmall" style={{ color: '#FF9800', fontWeight: 'bold' }}>
              Đạt {(Math.min((baseDonation + donation) / 6000000, 1) * 100).toFixed(1)}%
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text variant="bodySmall" style={{ color: '#5F6368', fontStyle: 'italic' }}>
              ❤️ Bạn đã đóng góp: <Text style={{ fontWeight: 'bold', color: '#D84315' }}>{myDonation.toLocaleString('vi-VN')} đ</Text>
            </Text>
          </View>
        </View>
      </Surface>

      <View style={styles.bannerContainer}>
        <ScrollView
          ref={bannerScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleBannerScrollEnd}
          style={{ width: bannerWidth, height: 160, borderRadius: 20 }}
        >
          <Image 
            source={require('../../assets/banner.jpg')} 
            style={[styles.bannerImage, { width: bannerWidth }]} 
            resizeMode="cover" 
          />
          <Image 
            source={require('../../assets/banner2.jpg')} 
            style={[styles.bannerImage, { width: bannerWidth }]} 
            resizeMode="cover" 
          />
          <Image 
            source={require('../../assets/banner.jpg')} 
            style={[styles.bannerImage, { width: bannerWidth }]} 
            resizeMode="cover" 
          />
        </ScrollView>
      </View>

      <View style={styles.statsGrid}>
        <Surface style={[styles.statCard, { backgroundColor: '#FFF3E0' }]} elevation={0}>
          <View style={{ backgroundColor: '#E65100', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <MaterialIcons name="payments" size={20} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: '#E65100' }]}>{awaitPayCount}</Text>
          <Text style={styles.statLabel}>Chờ thanh toán</Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: '#E3F2FD' }]} elevation={0}>
          <View style={{ backgroundColor: '#1565C0', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <MaterialIcons name="local-laundry-service" size={20} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: '#1565C0' }]}>{awaitWashCount}</Text>
          <Text style={styles.statLabel}>Chờ giặt</Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: '#F3E5F5' }]} elevation={0}>
          <View style={{ backgroundColor: '#7B1FA2', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <MaterialIcons name="wb-sunny" size={20} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: '#7B1FA2' }]}>{awaitDryCount}</Text>
          <Text style={styles.statLabel}>Chờ phơi</Text>
        </Surface>
        <Surface style={[styles.statCard, { backgroundColor: '#E6F4EA' }]} elevation={0}>
          <View style={{ backgroundColor: '#1E8E3E', width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <MaterialIcons name="check-circle" size={20} color="#fff" />
          </View>
          <Text style={[styles.statValue, { color: '#1E8E3E' }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Hoàn thành</Text>
        </Surface>
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>Hóa đơn gần đây</Text>
    </View>
  ), [baseDonation, donation, myDonation, bannerWidth, awaitPayCount, awaitWashCount, awaitDryCount, completedCount]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }]}>
        <Avatar.Icon size={52} icon="face-man-profile" style={{ backgroundColor: '#E8EAED', marginRight: 16 }} color="#1A73E8" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" style={{ color: '#5F6368', marginBottom: 2 }}>{getGreeting()}</Text>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#1A73E8' }} numberOfLines={1}>{auth.currentUser?.email}</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderHistoryItem(item)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? renderSkeletons() : (
          <View style={styles.emptyState}>
            <Text style={{ color: '#5F6368' }}>Chưa có đơn hàng nào.</Text>
          </View>
        )}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={10}
      />


      <InvoiceModal 
        visible={!!selectedOrder} 
        orderData={selectedOrder} 
        onClose={() => setSelectedOrder(null)} 
        onEdit={(order) => navigation.navigate('Form', { orderData: order })}
        onSchedule={handleScheduleOrder}
        onCancel={handleCancelOrder}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  content: {
    padding: 24,
    paddingBottom: 140,
  },
  bannerContainer: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bannerImage: {
    width: '100%',
    height: 160,
    borderRadius: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A73E8',
  },
  statLabel: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#202124',
    fontSize: 18,
  },
  historyCard: {
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  historyCardContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  historyIconContainer: {
    marginRight: 16,
    backgroundColor: '#F1F3F4',
    borderRadius: 24,
    padding: 4,
  },
  historyMain: {
    flex: 1,
  },
  historyPrice: {
    marginLeft: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A73E8',
    borderRadius: 24,
  },
});

export default HomeScreen;
