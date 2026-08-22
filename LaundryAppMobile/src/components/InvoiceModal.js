import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Modal, Image, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, Surface, IconButton, Button, RadioButton, TextInput } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

const InvoiceModal = ({ visible, orderData, onClose, onEdit, onSchedule, onCancel }) => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Thay đổi ý định');
  const [customReason, setCustomReason] = useState('');
  if (!orderData) return null;

  const handleConfirmCancel = () => {
    let finalReason = cancelReason;
    if (cancelReason === 'other') {
      if (!customReason.trim()) {
        alert('Vui lòng nhập lý do hủy đơn!');
        return;
      }
      finalReason = customReason.trim();
    }
    setShowCancelModal(false);
    setCancelReason('Thay đổi ý định');
    setCustomReason('');
    if (onCancel) {
      onCancel(orderData, finalReason);
    }
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelReason('Thay đổi ý định');
    setCustomReason('');
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'draft': return { text: 'Lưu Tạm', bg: '#FEF7E0', color: '#F9AB00' };
      case 'awaiting_payment':
      case 'pending':
        return { text: 'Chờ Thanh Toán', bg: '#FFEBEE', color: '#D32F2F' };
      case 'awaiting_wash': return { text: 'Chờ Giặt', bg: '#E3F2FD', color: '#1976D2' };
      case 'awaiting_dry': return { text: 'Chờ Phơi', bg: '#F3E5F5', color: '#7B1FA2' };
      case 'completed': return { text: 'Hoàn Thành', bg: '#E6F4EA', color: '#1E8E3E' };
      case 'cancelled': return { text: 'Đã Hủy', bg: '#FCE8E6', color: '#C5221F' };
      default: return { text: '', bg: 'transparent', color: '#000' };
    }
  };

  const getProcessImage = () => {
    const status = orderData.status;
    if (orderData.processImages && orderData.processImages[status]) {
      return orderData.processImages[status];
    }
    return null;
  };

  const statusInfo = getStatusInfo(orderData.status);
  const processImage = getProcessImage();
  const isPending = orderData.status === 'awaiting_payment' || orderData.status === 'pending';

  const dateStr = new Date(orderData.timestamp).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const totalQty = orderData.items.reduce((sum, item) => sum + item.qty, 0);
  const washTime = Math.ceil(totalQty / 10) || 1; // 1 tiếng cho mỗi 10 món đồ
  const dryTime = orderData.items.reduce((sum, item) => sum + (item.qty * (item.time || 1)), 0);
  const totalHours = washTime + dryTime;

  // Tính ETA có tính giờ nghỉ (22h - 6h)
  let etaDate = new Date(orderData.timestamp);
  let remainingHours = totalHours;
  while (remainingHours > 0) {
    etaDate = new Date(etaDate.getTime() + 1 * 3600 * 1000); // cộng 1 tiếng
    const h = etaDate.getHours();
    if (h >= 6 && h < 22) {
      remainingHours--; // chỉ trừ giờ làm việc (6h - 22h)
    }
  }
  // Nếu ETA rơi vào sau 22h, đẩy sang 6h sáng hôm sau
  if (etaDate.getHours() >= 22 || etaDate.getHours() < 6) {
    etaDate.setDate(etaDate.getDate() + (etaDate.getHours() >= 22 ? 1 : 0));
    etaDate.setHours(6, 0, 0, 0);
  }
  
  const cancelDate = new Date(orderData.timestamp + 7 * 24 * 3600 * 1000);
  const cancelDateStr = cancelDate.toLocaleDateString('vi-VN');

  const canCancel = orderData.status !== 'completed' && orderData.status !== 'cancelled' && orderData.status !== 'draft';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="close" onPress={onClose} iconColor="#5F6368" />
          <Text variant="titleLarge" style={styles.title}>Chi Tiết Hóa Đơn</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {orderData.status !== 'draft' && orderData.status !== 'completed' && (
            <Surface style={[styles.paymentNotice, { backgroundColor: '#E6F4EA', borderColor: '#CEEAD6', marginTop: 0, marginBottom: 20 }]} elevation={1}>
              <MaterialIcons name="schedule" size={24} color="#1E8E3E" style={{ marginRight: 12, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1E8E3E', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#1E8E3E' }}>Giặt Nhanh Đúng Hẹn: </Text>
                  Xong trước <Text style={{ fontWeight: 'bold', color: '#1E8E3E' }}>{etaDate.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text> ngày <Text style={{ fontWeight: 'bold', color: '#1E8E3E' }}>{etaDate.getDate()} tháng {etaDate.getMonth() + 1} năm {etaDate.getFullYear()}</Text>
                </Text>
                <Text style={{ color: '#1E8E3E', fontSize: 12, fontWeight: '600' }}>
                  * Nếu trễ hẹn, tặng ngay Voucher 15K!
                </Text>
              </View>
            </Surface>
          )}

          <View style={styles.receiptWrapper}>
            <View style={styles.receiptBox}>
              <View style={styles.receiptHeader}>
                <View>
                  <Text variant="labelMedium" style={{ color: '#5F6368', textTransform: 'uppercase' }}>Mã Đơn Hàng</Text>
                  <Text variant="titleMedium" style={{ fontWeight: '900', letterSpacing: 1 }}>{orderData.id}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
                  <Text style={{ color: statusInfo.color, fontSize: 12, fontWeight: 'bold' }}>
                    {statusInfo.text}
                  </Text>
                </View>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text variant="labelMedium" style={{ color: '#5F6368', textTransform: 'uppercase' }}>Ngày Đặt Lịch</Text>
                <Text variant="bodyMedium" style={{ fontWeight: '500' }}>{dateStr}</Text>
              </View>

              <View style={styles.dashedDivider} />

              <View style={styles.itemsList}>
                {orderData.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text variant="bodyMedium" style={{ flex: 1, color: '#202124' }}>{item.name} <Text style={{ color: '#5F6368' }}>x{item.qty}</Text></Text>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                      {(item.price * item.qty).toLocaleString('vi-VN')} đ
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.dashedDivider} />

              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#5F6368', fontSize: 14 }}>Tạm tính</Text>
                  <Text style={{ color: '#202124', fontSize: 14, fontWeight: '500' }}>
                    {(orderData.subtotal || orderData.total).toLocaleString('vi-VN')} đ
                  </Text>
                </View>
                
                {orderData.discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialIcons name="local-offer" size={14} color="#E91E63" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#E91E63', fontSize: 14 }}>Khuyến mãi ({orderData.promoCode})</Text>
                    </View>
                    <Text style={{ color: '#E91E63', fontSize: 14, fontWeight: 'bold' }}>
                      - {orderData.discount.toLocaleString('vi-VN')} đ
                    </Text>
                  </View>
                )}

                {orderData.surcharge > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#E65100', fontSize: 13 }}>• Tiền nước</Text>
                      <Text style={{ color: '#E65100', fontSize: 13 }}>+{orderData.feeWater?.toLocaleString('vi-VN')} đ</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#E65100', fontSize: 13 }}>• Tiền xà bông</Text>
                      <Text style={{ color: '#E65100', fontSize: 13 }}>+{orderData.feeSoap?.toLocaleString('vi-VN')} đ</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#E65100', fontSize: 13 }}>• Tiền công</Text>
                      <Text style={{ color: '#E65100', fontSize: 13 }}>+{orderData.feeLabor?.toLocaleString('vi-VN')} đ</Text>
                    </View>
                  </View>
                )}

                {orderData.cancelPenalty > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#D32F2F', fontSize: 13, fontWeight: '600' }}>• Phí phạt hủy đơn</Text>
                      <Text style={{ color: '#D32F2F', fontSize: 13, fontWeight: '700' }}>+{orderData.cancelPenalty.toLocaleString('vi-VN')} đ</Text>
                    </View>
                  </View>
                )}

                {!orderData.surcharge && (orderData.subtotal || orderData.total) >= 50000 && (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#1E8E3E', fontSize: 13 }}>• Tiền nước</Text>
                      <Text style={{ color: '#1E8E3E', fontSize: 13, fontWeight: '700' }}>Miễn phí</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#1E8E3E', fontSize: 13 }}>• Tiền xà bông</Text>
                      <Text style={{ color: '#1E8E3E', fontSize: 13, fontWeight: '700' }}>Miễn phí</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#1E8E3E', fontSize: 13 }}>• Tiền công</Text>
                      <Text style={{ color: '#1E8E3E', fontSize: 13, fontWeight: '700' }}>Miễn phí</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.dashedDivider} />

              <View style={styles.totalRow}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#5F6368' }}>TỔNG CỘNG</Text>
                <Text variant="headlineSmall" style={{ color: '#1A73E8', fontWeight: '900' }}>
                  {orderData.total.toLocaleString('vi-VN')} đ
                </Text>
              </View>
            </View>
            
            {/* Ticket Cutouts */}
            <View style={{ position: 'absolute', top: '50%', left: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#F8F9FA' }} />
            <View style={{ position: 'absolute', top: '50%', right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#F8F9FA' }} />
          </View>

          {isPending && (
            <Surface style={styles.paymentNotice} elevation={1}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <MaterialIcons name="info" size={24} color="#D32F2F" style={{ marginRight: 12, marginTop: 2 }} />
                <Text style={{ color: '#D32F2F', flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>
                  Vui lòng thanh toán trước hóa đơn này để chúng tôi tiếp tục xử lý giặt ủi cho bạn!
                  {"\n\n"}<Text style={{ fontWeight: 'bold', color: '#D32F2F' }}>Lưu ý:</Text> Nếu chưa thanh toán vào ngày {cancelDateStr}, đơn hàng sẽ tự động hủy.
                </Text>
              </View>
            </Surface>
          )}

          {orderData.status === 'cancelled' && (
            <Surface style={[styles.paymentNotice, { backgroundColor: '#FCE8E6', borderColor: '#FAD2CF' }]} elevation={1}>
              <MaterialIcons name="cancel" size={24} color="#C5221F" style={{ marginRight: 12, marginTop: 2 }} />
              <Text style={{ color: '#C5221F', flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 }}>
                Đơn hàng đã bị hủy.
                {"\n\n"}<Text style={{ fontWeight: 'bold', color: '#C5221F' }}>Lý do:</Text> {orderData.cancelReason || 'Không có lý do'}
              </Text>
            </Surface>
          )}

          {orderData.status !== 'draft' && !isPending && orderData.status !== 'cancelled' && (
            <View style={styles.imageContainer}>
              <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: 'bold', color: '#202124' }}>Ảnh tiến độ quá trình:</Text>
              {processImage ? (
                <Image source={{ uri: processImage }} style={styles.processImage} />
              ) : (
                <View style={[styles.processImage, { justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialIcons name="image-not-supported" size={48} color="#BDBDBD" />
                  <Text style={{ color: '#9E9E9E', marginTop: 8, fontSize: 14, fontWeight: '500' }}>No Image</Text>
                </View>
              )}
            </View>
          )}

          {orderData.photoUrl && (
            <View style={[styles.imageContainer, { marginTop: processImage ? 24 : 8 }]}>
              <Text variant="titleMedium" style={{ marginBottom: 12, fontWeight: 'bold', color: '#202124' }}>Vị trí bỏ đồ giặt:</Text>
              <Image source={{ uri: orderData.photoUrl }} style={styles.processImage} />
            </View>
          )}

        </ScrollView>

        {orderData.status === 'draft' && (
          <View style={{ padding: 16, backgroundColor: '#fff', flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F1F3F4' }}>
            <Button 
              mode="outlined" 
              icon="pencil" 
              style={{ flex: 1, borderColor: '#1A73E8' }}
              textColor="#1A73E8"
              onPress={() => {
                onClose();
                if(onEdit) onEdit(orderData);
              }}
            >
              Chỉnh sửa
            </Button>
            <Button 
              mode="contained" 
              icon="calendar-check" 
              style={{ flex: 1, backgroundColor: '#1A73E8' }}
              onPress={() => {
                onClose();
                if(onSchedule) onSchedule(orderData);
              }}
            >
              Đặt lịch
            </Button>
          </View>
        )}

        {canCancel && (
          <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F3F4' }}>
            <Button 
              mode="outlined" 
              icon="cancel"
              textColor="#D32F2F" 
              style={{ borderColor: '#D32F2F' }}
              onPress={() => setShowCancelModal(true)}
            >
              Hủy Đơn Hàng
            </Button>
          </View>
        )}
      </View>

      {/* Cancel Bottom Sheet Modal */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={closeCancelModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeCancelModal} />
          <Surface style={styles.bottomSheet} elevation={8}>
            <View style={styles.bottomSheetHandle} />
            <Text variant="titleLarge" style={{ fontWeight: 'bold', color: '#202124', marginBottom: 16 }}>Lý do hủy đơn</Text>
            
            <RadioButton.Group onValueChange={value => setCancelReason(value)} value={cancelReason}>
              <RadioButton.Item label="Thay đổi ý định" value="Thay đổi ý định" color="#D32F2F" />
              <RadioButton.Item label="Đặt nhầm món đồ / sai số lượng" value="Đặt nhầm món đồ / sai số lượng" color="#D32F2F" />
              <RadioButton.Item label="Tìm được chỗ khác rẻ hơn" value="Tìm được chỗ khác rẻ hơn" color="#D32F2F" />
              <RadioButton.Item label="Lý do khác" value="other" color="#D32F2F" />
            </RadioButton.Group>

            {cancelReason === 'other' && (
              <TextInput
                mode="outlined"
                label="Nhập lý do của bạn..."
                value={customReason}
                onChangeText={setCustomReason}
                style={{ marginTop: 8, backgroundColor: '#fff' }}
                outlineColor="#E8EAED"
                activeOutlineColor="#D32F2F"
                multiline
                numberOfLines={3}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Button mode="outlined" style={{ flex: 1, borderColor: '#5F6368' }} textColor="#5F6368" onPress={closeCancelModal}>
                Thoát
              </Button>
              <Button mode="contained" style={{ flex: 1, backgroundColor: '#D32F2F' }} onPress={handleConfirmCancel}>
                Xác nhận hủy
              </Button>
            </View>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  title: {
    fontWeight: 'bold',
    color: '#202124',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  receiptWrapper: {
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24,
    marginHorizontal: 4,
  },
  receiptBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderTopWidth: 6,
    borderTopColor: '#1A73E8',
    overflow: 'hidden',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dashedDivider: {
    borderBottomWidth: 2,
    borderBottomColor: '#E8EAED',
    borderStyle: 'dashed',
    marginVertical: 20,
    marginHorizontal: -8, // slight bleed
  },
  itemsList: {
    marginVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  paymentNotice: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    alignItems: 'flex-start',
  },
  imageContainer: {
    marginTop: 8,
  },
  processImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E8EAED',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
});

export default InvoiceModal;
