import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, Image } from 'react-native';
import { Text, Surface, IconButton, Switch, Divider, Button, Dialog, Portal, Paragraph, TextInput, Avatar } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../services/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const SettingsScreen = ({ navigation }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Dialog đổi mật khẩu
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Dialog xác nhận xóa cache
  const [clearCacheDialog, setClearCacheDialog] = useState(false);

  // Dialog thông báo kết quả
  const [resultDialog, setResultDialog] = useState({ visible: false, title: '', message: '', isError: false });

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setResultDialog({ visible: true, title: 'Thiếu thông tin', message: 'Vui lòng điền đầy đủ các trường!', isError: true });
      return;
    }
    if (newPassword.length < 6) {
      setResultDialog({ visible: true, title: 'Mật khẩu yếu', message: 'Mật khẩu mới phải có ít nhất 6 ký tự!', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResultDialog({ visible: true, title: 'Không khớp', message: 'Mật khẩu mới không khớp!', isError: true });
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordDialogVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResultDialog({ visible: true, title: 'Thành công', message: 'Đổi mật khẩu thành công!', isError: false });
    } catch (error) {
      let msg = 'Có lỗi xảy ra, vui lòng thử lại!';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Mật khẩu hiện tại không đúng!';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Mật khẩu mới quá yếu, hãy đặt ít nhất 6 ký tự!';
      } else if (error.code === 'auth/requires-recent-login') {
        msg = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Bạn đã thử quá nhiều lần, vui lòng chờ một lát!';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'Không có kết nối mạng, kiểm tra lại WiFi/4G nhé!';
      }
      setResultDialog({ visible: true, title: 'Lỗi', message: msg, isError: true });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await AsyncStorage.removeItem('saved_invoices_mobile');
      setClearCacheDialog(false);
      setResultDialog({ visible: true, title: 'Thành công', message: 'Đã xóa bộ nhớ đệm!', isError: false });
    } catch (error) {
      setResultDialog({ visible: true, title: 'Lỗi', message: 'Có lỗi xảy ra, vui lòng thử lại!', isError: true });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Navigation will automatically handle this if auth state changes are listened to
    } catch (error) {
      setResultDialog({ visible: true, title: 'Lỗi', message: 'Đăng xuất thất bại!', isError: true });
    }
  };

  const MenuItem = ({ icon, iconColor, iconBg, label, desc, onPress, right, danger }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuItem}>
        <View style={[styles.menuIconBox, { backgroundColor: iconBg || '#F1F3F4' }]}>
          <MaterialIcons name={icon} size={22} color={iconColor || '#5F6368'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.menuLabel, danger && { color: '#D32F2F' }]}>{label}</Text>
          {desc && <Text style={styles.menuDesc}>{desc}</Text>}
        </View>
        {right || <MaterialIcons name="chevron-right" size={22} color="#C4C7CC" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" iconColor="#000" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.title}>Cài Đặt</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Bảo mật */}
        <Text style={styles.sectionTitle}>Bảo mật</Text>
        <Surface style={styles.sectionCard} elevation={2}>
          <MenuItem
            icon="lock-outline"
            iconColor="#1A73E8"
            iconBg="#E8F0FE"
            label="Đổi mật khẩu"
            desc="Cập nhật mật khẩu mới an toàn hơn"
            onPress={() => setPasswordDialogVisible(true)}
          />
        </Surface>

        {/* Dữ liệu */}
        <Text style={styles.sectionTitle}>Dữ liệu & Cấu hình</Text>
        <Surface style={styles.sectionCard} elevation={2}>
          <MenuItem
            icon="delete-outline"
            iconColor="#E91E63"
            iconBg="#FCE4EC"
            label="Xóa bộ nhớ đệm"
            desc="Dọn dẹp dữ liệu tạm để app mượt hơn"
            onPress={() => setClearCacheDialog(true)}
          />
        </Surface>

        {/* Thông tin app */}
        <Text style={styles.sectionTitle}>Về ứng dụng</Text>
        <Surface style={styles.sectionCard} elevation={2}>
          <MenuItem
            icon="info-outline"
            iconColor="#1E8E3E"
            iconBg="#E6F4EA"
            label="Phiên bản"
            desc="Đã cập nhật OTA thành công!"
            right={<Text style={{ color: '#1E8E3E', fontSize: 13, fontWeight: 'bold', backgroundColor: '#E6F4EA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>v1.0.1</Text>}
          />
          <Divider />
          <MenuItem
            icon="system-update"
            iconColor="#FF9800"
            iconBg="#FFF3E0"
            label="Trạng thái OTA"
            desc={Updates.channel ? `Kênh: ${Updates.channel}` : 'Không có OTA'}
            right={<Text style={{ color: '#5F6368', fontSize: 12 }}>{Updates.updateId ? Updates.updateId.substring(0, 8) : 'Bản gốc'}</Text>}
            onPress={() => {
                alert(`Kênh: ${Updates.channel || 'N/A'}\nUpdate ID: ${Updates.updateId || 'N/A'}\nRuntime: ${Updates.runtimeVersion || 'N/A'}`);
            }}
          />
        </Surface>

      </ScrollView>

      {/* Dialog đổi mật khẩu */}
      <Portal>
        <Dialog visible={passwordDialogVisible} onDismiss={() => setPasswordDialogVisible(false)} style={{ borderRadius: 24, backgroundColor: '#fff' }}>
          <Dialog.Title style={{ fontWeight: 'bold', color: '#202124', textAlign: 'center' }}>Đổi Mật Khẩu</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Mật khẩu hiện tại"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="outlined"
              secureTextEntry={!showCurrentPw}
              right={<TextInput.Icon icon={showCurrentPw ? "eye-off" : "eye"} onPress={() => setShowCurrentPw(!showCurrentPw)} />}
              style={styles.pwInput}
              outlineStyle={{ borderRadius: 12 }}
            />
            <TextInput
              label="Mật khẩu mới"
              value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined"
              secureTextEntry={!showNewPw}
              right={<TextInput.Icon icon={showNewPw ? "eye-off" : "eye"} onPress={() => setShowNewPw(!showNewPw)} />}
              style={styles.pwInput}
              outlineStyle={{ borderRadius: 12 }}
            />
            <TextInput
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showNewPw}
              style={styles.pwInput}
              outlineStyle={{ borderRadius: 12 }}
            />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button onPress={() => setPasswordDialogVisible(false)} textColor="#5F6368">Hủy</Button>
            <Button
              mode="contained"
              onPress={handleChangePassword}
              loading={changingPassword}
              style={{ borderRadius: 12, paddingHorizontal: 16 }}
            >
              Đổi mật khẩu
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog xóa cache */}
        <Dialog visible={clearCacheDialog} onDismiss={() => setClearCacheDialog(false)} style={{ borderRadius: 24, backgroundColor: '#fff' }}>
          <Dialog.Title style={{ fontWeight: 'bold', color: '#D32F2F', textAlign: 'center' }}>Xóa Bộ Nhớ Đệm?</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: '#5F6368', textAlign: 'center' }}>Thao tác này sẽ xóa toàn bộ dữ liệu tạm trên máy. Các đơn hàng đã đặt trên hệ thống sẽ không bị ảnh hưởng.</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button onPress={() => setClearCacheDialog(false)} textColor="#5F6368">Hủy</Button>
            <Button mode="contained" onPress={handleClearCache} buttonColor="#D32F2F" style={{ borderRadius: 12 }}>Xóa</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog thông báo kết quả */}
        <Dialog visible={resultDialog.visible} onDismiss={() => setResultDialog(prev => ({ ...prev, visible: false }))} style={{ borderRadius: 24, backgroundColor: '#fff' }}>
          <Dialog.Title style={{ fontWeight: 'bold', color: resultDialog.isError ? '#D32F2F' : '#1E8E3E', textAlign: 'center' }}>{resultDialog.title}</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: '#5F6368', fontSize: 15, textAlign: 'center' }}>{resultDialog.message}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'center', paddingBottom: 16 }}>
            <Button mode="contained" onPress={() => setResultDialog(prev => ({ ...prev, visible: false }))} style={{ borderRadius: 12, paddingHorizontal: 24 }} buttonColor={resultDialog.isError ? '#D32F2F' : '#1E8E3E'}>Đã hiểu</Button>
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
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9AA0A6',
    marginBottom: 10,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 0,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    borderWidth: 0,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23, // Tròn xoe
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuLabel: {
    fontSize: 16,
    color: '#202124',
    fontWeight: '700',
  },
  menuDesc: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 3,
  },
  pwInput: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: {
    color: '#D32F2F',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen;
