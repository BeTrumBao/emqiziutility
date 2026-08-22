import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, KeyboardAvoidingView } from 'react-native';
import { Text, Surface, IconButton, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { auth, firestore } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ProfileScreen = ({ navigation }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMsg, setSnackMsg] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        try {
          const docRef = doc(firestore, 'users', auth.currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFullName(data.fullName || '');
            setPhone(data.phone || '');
            setAddress(data.address || '');
            setBirthDate(data.birthDate || '');
          }
        } catch (error) {
          console.log('Error fetching profile:', error);
        }
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(firestore, 'users', auth.currentUser.uid);
      await setDoc(docRef, {
        fullName,
        phone,
        address,
        birthDate,
        email: auth.currentUser.email,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setEditing(false);
      setSnackMsg('Đã lưu thông tin thành công!');
      setSnackVisible(true);
    } catch (error) {
      setSnackMsg('Có lỗi xảy ra: ' + error.message);
      setSnackVisible(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" iconColor="#000" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={styles.title}>Thông Tin Cá Nhân</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
          <View style={[styles.editBtn, editing && { backgroundColor: '#1A73E8' }]}>
            <MaterialIcons name={editing ? "check" : "edit"} size={20} color={editing ? '#fff' : '#1A73E8'} />
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {fullName ? fullName[0].toUpperCase() : (auth.currentUser?.email?.[0]?.toUpperCase() || '?')}
              </Text>
            </View>
            <Text style={styles.emailText}>{auth.currentUser?.email}</Text>
          </View>

          {/* Họ và tên */}
          <Surface style={styles.infoRow} elevation={1}>
            <View style={[styles.infoIconBox, { backgroundColor: editing ? '#E8F0FE' : '#F1F3F4' }]}>
              <MaterialIcons name="person" size={22} color={editing ? '#1A73E8' : '#5F6368'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Họ và tên</Text>
              {editing ? (
                <TextInput value={fullName} onChangeText={setFullName} mode="flat" dense style={styles.infoInput} underlineColor="transparent" activeUnderlineColor="#1A73E8" />
              ) : (
                <Text style={styles.infoValue}>{fullName || 'Chưa cập nhật'}</Text>
              )}
            </View>
          </Surface>

          {/* Số điện thoại */}
          <Surface style={styles.infoRow} elevation={1}>
            <View style={[styles.infoIconBox, { backgroundColor: editing ? '#E8F0FE' : '#F1F3F4' }]}>
              <MaterialIcons name="phone" size={22} color={editing ? '#1A73E8' : '#5F6368'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Số điện thoại</Text>
              {editing ? (
                <TextInput value={phone} onChangeText={setPhone} mode="flat" dense style={styles.infoInput} underlineColor="transparent" activeUnderlineColor="#1A73E8" keyboardType="phone-pad" />
              ) : (
                <Text style={styles.infoValue}>{phone || 'Chưa cập nhật'}</Text>
              )}
            </View>
          </Surface>


          {editing && (
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={() => setEditing(false)}
                style={styles.cancelBtn}
                textColor="#5F6368"
              >
                Hủy
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                style={styles.saveBtn}
                icon="content-save"
              >
                Lưu Thay Đổi
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={2000}
        style={{ backgroundColor: '#1E8E3E', borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{snackMsg}</Text>
      </Snackbar>
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
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1A73E8',
  },
  emailText: {
    fontSize: 15,
    color: '#5F6368',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#202124',
    fontWeight: '600',
  },
  infoInput: {
    backgroundColor: '#F8F9FA',
    fontSize: 16,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelBtn: {
    flex: 0.35,
    borderColor: '#E8EAED',
    borderRadius: 12,
  },
  saveBtn: {
    flex: 0.6,
    borderRadius: 12,
  },
});

export default ProfileScreen;
