import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, ScrollView, Dimensions } from 'react-native';
import { Text, Avatar, Surface, ProgressBar, Portal, Dialog, Button, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import Skeleton from '../components/Skeleton';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { auth, firestore, db } from '../services/firebase';

const { width } = Dimensions.get('window');

const AccountScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [vipModalVisible, setVipModalVisible] = useState(false);
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const userEmail = auth.currentUser?.email || 'Khách';
  const initial = userEmail[0].toUpperCase();

  useFocusEffect(
    useCallback(() => {
      const fetchUser = async () => {
        if (auth.currentUser) {
          try {
            const docRef = doc(firestore, 'users', auth.currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setUserData(docSnap.data());
            }

            const ordersRef = query(ref(db, 'laundry_orders'), orderByChild('uid'), equalTo(auth.currentUser.uid));
            const ordersSnap = await get(ordersRef);
            if (ordersSnap.exists()) {
              const orders = Object.values(ordersSnap.val());
              const spent = orders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
              setTotalSpent(spent);
            } else {
              setTotalSpent(0);
            }
          } catch (error) {
            console.log('Error fetching user data:', error);
          } finally {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      };
      fetchUser();
    }, [])
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log('Logout error', error);
    }
  };

  const VIP_TIERS = [
    { level: 1, threshold: 0, name: 'VIP 1', color: '#A9A9A9', icon: 'emoji-events' },
    { level: 2, threshold: 500000, name: 'VIP 2', color: '#78909C', icon: 'emoji-events' },
    { level: 3, threshold: 1000000, name: 'VIP 3', color: '#1E90FF', icon: 'emoji-events' },
    { level: 4, threshold: 2000000, name: 'VIP 4', color: '#4CAF50', icon: 'emoji-events' },
    { level: 5, threshold: 5000000, name: 'VIP 5', color: '#00BCD4', icon: 'emoji-events' },
    { level: 6, threshold: 10000000, name: 'VIP 6', color: '#9370DB', icon: 'emoji-events' },
    { level: 7, threshold: 20000000, name: 'VIP 7', color: '#8E24AA', icon: 'emoji-events' },
    { level: 8, threshold: 30000000, name: 'VIP 8', color: '#C2185B', icon: 'emoji-events' },
    { level: 9, threshold: 50000000, name: 'VIP 9', color: '#E91E63', icon: 'emoji-events' },
    { level: 10, threshold: 100000000, name: 'VIP 10', color: '#FF4500', icon: 'emoji-events' },
    { level: 11, threshold: 200000000, name: 'VIP 11', color: '#D4AF37', icon: 'emoji-events' },
    { level: 12, threshold: 500000000, name: 'VIP 12', color: '#E5E4E2', icon: 'emoji-events' },
    { level: 13, threshold: 1000000000, name: 'VIP 13', color: '#00FA9A', icon: 'emoji-events' },
    { level: 14, threshold: 2000000000, name: 'VIP 14', color: '#DC143C', icon: 'emoji-events' },
    { level: 15, threshold: 5000000000, name: 'VIP 15', color: '#000000', icon: 'emoji-events' }
  ];

  const getRank = (spent) => {
    let currentTier = VIP_TIERS[0];
    let nextTier = VIP_TIERS[1];
    for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
      if (spent >= VIP_TIERS[i].threshold) {
        currentTier = VIP_TIERS[i];
        nextTier = i < VIP_TIERS.length - 1 ? VIP_TIERS[i + 1] : null;
        break;
      }
    }
    if (!nextTier) return { ...currentTier, next: null, progress: 1 };
    const tierSpan = nextTier.threshold - currentTier.threshold;
    const progress = (spent - currentTier.threshold) / tierSpan;
    return { ...currentTier, next: nextTier.threshold, progress };
  };

  const rank = getRank(totalSpent);

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header Gradient */}
        <LinearGradient
          colors={['#1A73E8', '#4285F4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.avatarWrapper}>
              <Avatar.Icon size={90} icon="face-man-profile" style={styles.avatar} color="#1A73E8" />
            </View>
            <View style={styles.userInfo}>
              {loading ? (
                <>
                  <Skeleton width={120} height={20} style={{ marginBottom: 6 }} />
                  <Skeleton width={80} height={14} />
                </>
              ) : (
                <>
                  <Text style={styles.userName}>{userData?.fullName || 'Người dùng mới'}</Text>
                  <Text style={styles.userEmail}>{userEmail}</Text>
                </>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* VIP Card Overlapping */}
        <View style={styles.vipCardContainer}>
          <LinearGradient
            colors={['#ffffff', '#F8FBFF']}
            style={styles.vipCard}
          >
            {loading ? (
              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                   <Skeleton width={90} height={28} borderRadius={14} />
                   <View style={{ alignItems: 'flex-end' }}>
                     <Skeleton width={70} height={14} style={{ marginBottom: 6 }} />
                     <Skeleton width={110} height={24} />
                   </View>
                </View>
                <Skeleton width="100%" height={12} borderRadius={6} style={{ marginBottom: 12 }} />
                <Skeleton width={180} height={14} />
              </View>
            ) : (
              <>
                <View style={styles.vipHeader}>
                  <TouchableOpacity style={styles.vipBadge} onPress={() => setVipModalVisible(true)} activeOpacity={0.7}>
                    <MaterialIcons name="emoji-events" size={20} color={rank.color} />
                    <Text style={[styles.vipName, { color: rank.color }]}>{rank.name}</Text>
                  </TouchableOpacity>
                  <View style={styles.spentBox}>
                    <Text style={styles.spentLabel}>Đã chi tiêu</Text>
                    <Text style={styles.spentAmount}>{totalSpent.toLocaleString('vi-VN')} đ</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressText}>{rank.next ? 'Tiến trình thăng hạng' : 'Tiến trình thăng hạng'}</Text>
                    <Text style={styles.progressTextDark}>{rank.next ? Math.round(rank.progress * 100) : 100}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={[rank.color, rank.color + '99']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${rank.next ? Math.max(0, Math.min(100, rank.progress * 100)) : 100}%` }]}
                    />
                  </View>
                  <Text style={styles.progressHint}>
                    {rank.next ? (
                      <>Chỉ cần <Text style={{ fontWeight: 'bold', color: '#1A73E8' }}>{(rank.next - totalSpent).toLocaleString('vi-VN')} đ</Text> nữa để lên <Text style={{ color: getRank(rank.next).color, fontWeight: 'bold' }}>{getRank(rank.next).name}</Text></>
                    ) : (
                      <Text style={{ fontWeight: 'bold', color: rank.color }}>Đã đạt mức VIP tối đa</Text>
                    )}
                  </Text>
                </View>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Tùy chỉnh</Text>
          
          {loading ? (
            <>
              <Skeleton width="100%" height={68} borderRadius={20} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={68} borderRadius={20} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={68} borderRadius={20} style={{ marginBottom: 12 }} />
              <Skeleton width="100%" height={68} borderRadius={20} style={{ marginBottom: 12 }} />
            </>
          ) : (
            <>
              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Profile')}>
                <Surface style={styles.menuItemCard} elevation={0}>
                  <View style={[styles.menuIconBg, { backgroundColor: '#E8F0FE' }]}>
                    <MaterialIcons name="person" size={24} color="#1A73E8" />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Thông tin cá nhân</Text>
                    <Text style={styles.menuSubtitle}>Cập nhật tên, địa chỉ, ngày sinh</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#C4C7CC" />
                </Surface>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Settings')}>
                <Surface style={styles.menuItemCard} elevation={0}>
                  <View style={[styles.menuIconBg, { backgroundColor: '#F3F4F6' }]}>
                    <MaterialIcons name="settings" size={24} color="#5F6368" />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Cài đặt</Text>
                    <Text style={styles.menuSubtitle}>Mật khẩu, thông báo, ứng dụng</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color="#C4C7CC" />
                </Surface>
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Khác</Text>

              <TouchableOpacity activeOpacity={0.8} onPress={() => setLogoutDialogVisible(true)}>
                <Surface style={[styles.menuItemCard, { marginBottom: 0 }]} elevation={0}>
                  <View style={[styles.menuIconBg, { backgroundColor: '#FFEBEE' }]}>
                    <MaterialIcons name="logout" size={24} color="#D32F2F" />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={[styles.menuTitle, { color: '#D32F2F' }]}>Đăng xuất</Text>
                    <Text style={styles.menuSubtitle}>Thoát khỏi thiết bị này</Text>
                  </View>
                </Surface>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={vipModalVisible} onDismiss={() => setVipModalVisible(false)} style={{ borderRadius: 24, backgroundColor: '#fff', maxHeight: '80%' }}>
          <Dialog.Title style={{ color: '#1A73E8', fontWeight: 'bold', textAlign: 'center' }}>Danh Sách Cấp Bậc VIP</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
              {VIP_TIERS.map((tier, index) => (
                <View key={tier.level}>
                  {index > 0 && <Divider style={{ marginVertical: 12 }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tier.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                      <MaterialIcons name={tier.icon} size={28} color={tier.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: tier.color }}>{tier.name}</Text>
                      <Text style={{ fontSize: 14, color: '#5F6368', marginTop: 4 }}>
                        Mục tiêu: <Text style={{ fontWeight: 'bold', color: '#202124' }}>{tier.threshold === 0 ? 'Mới đăng ký' : tier.threshold.toLocaleString('vi-VN') + ' đ'}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button onPress={() => setVipModalVisible(false)} mode="contained" style={{ borderRadius: 12, paddingHorizontal: 16 }}>Đóng</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog xác nhận đăng xuất */}
        <Dialog visible={logoutDialogVisible} onDismiss={() => setLogoutDialogVisible(false)} style={{ borderRadius: 24, backgroundColor: '#fff' }}>
          <Dialog.Title style={{ fontWeight: 'bold', color: '#D32F2F', textAlign: 'center' }}>Đăng Xuất</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: '#5F6368', textAlign: 'center' }}>Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?</Text>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button onPress={() => setLogoutDialogVisible(false)} textColor="#5F6368">Hủy</Button>
            <Button mode="contained" onPress={() => { setLogoutDialogVisible(false); handleLogout(); }} buttonColor="#D32F2F" style={{ borderRadius: 12, paddingHorizontal: 16 }}>Đăng xuất</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 70,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 50,
  },
  avatar: {
    backgroundColor: '#fff',
  },
  avatarLabel: {
    color: '#1A73E8',
    fontWeight: '900',
    fontSize: 36,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  vipCardContainer: {
    marginHorizontal: 20,
    marginTop: -50, // This creates the overlapping effect
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  vipCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  vipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  vipName: {
    fontWeight: '900',
    fontSize: 18,
    marginLeft: 6,
  },
  spentBox: {
    alignItems: 'flex-end',
  },
  spentLabel: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 4,
  },
  spentAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#202124',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#5F6368',
    fontWeight: '600',
  },
  progressTextDark: {
    fontSize: 13,
    color: '#202124',
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E8EAED',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 12,
    color: '#80868B',
    marginTop: 12,
    textAlign: 'center',
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#5F6368',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 8,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  menuIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#80868B',
  }
});

export default AccountScreen;
