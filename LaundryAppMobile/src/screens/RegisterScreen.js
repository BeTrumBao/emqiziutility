import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { Text, TextInput, Button, Surface, IconButton, Snackbar } from 'react-native-paper';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, firestore } from '../services/firebase';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setSnackbarMessage('Vui lòng nhập đầy đủ thông tin!');
      return;
    }
    if (password !== confirmPassword) {
      setSnackbarMessage('Mật khẩu xác nhận không khớp!');
      return;
    }
    if (password.length < 6) {
      setSnackbarMessage('Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      
      // Save user to Firestore
      await setDoc(doc(firestore, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        createdAt: new Date().toISOString(),
        role: 'user'
      });

      setSnackbarMessage('Đăng ký tài khoản thành công!');
      // App.js onAuthStateChanged will handle navigation automatically
    } catch (error) {
      let errorMsg = 'Đăng ký thất bại: ' + error.message;
      if (error.code === 'auth/email-already-in-use') errorMsg = 'Email này đã được sử dụng!';
      else if (error.code === 'auth/invalid-email') errorMsg = 'Email không hợp lệ!';
      else if (error.code === 'auth/weak-password') errorMsg = 'Mật khẩu quá yếu (cần ít nhất 6 ký tự)!';
      else if (error.code === 'auth/network-request-failed') errorMsg = 'Lỗi mạng, vui lòng kiểm tra lại kết nối!';
      
      setSnackbarMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
        <Image source={require('../../assets/banner.jpg')} style={{ width: '100%', height: '55%', resizeMode: 'cover', opacity: 0.8 }} />
      </View>
      <View style={styles.topBar}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} iconColor="#fff" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
      </View>
      <KeyboardAvoidingView 
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Surface style={styles.contentCard} elevation={0}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 32 }}>
            <View style={styles.dragHandle} />
            <View style={styles.header}>
              <Text variant="headlineMedium" style={styles.title}>Đăng Ký</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>Tạo tài khoản để sử dụng dịch vụ</Text>
            </View>

            <TextInput
              label="Email"
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              outlineColor="#E8EAED"
              activeOutlineColor="#1A73E8"
              left={<TextInput.Icon icon="email" color="#5F6368" />}
            />

            <TextInput
              label="Mật khẩu"
              mode="outlined"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              outlineStyle={styles.inputOutline}
              outlineColor="#E8EAED"
              activeOutlineColor="#1A73E8"
              left={<TextInput.Icon icon="lock" color="#5F6368" />}
            />

            <TextInput
              label="Xác nhận mật khẩu"
              mode="outlined"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={styles.input}
              outlineStyle={styles.inputOutline}
              outlineColor="#E8EAED"
              activeOutlineColor="#1A73E8"
              left={<TextInput.Icon icon="lock-check" color="#5F6368" />}
            />

            <Button 
              mode="contained" 
              onPress={handleRegister} 
              loading={loading}
              disabled={loading}
              style={styles.registerBtn}
              labelStyle={styles.registerBtnLabel}
              contentStyle={{ paddingVertical: 10 }}
            >
              Đăng Ký
            </Button>
          </ScrollView>
        </Surface>
      </KeyboardAvoidingView>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage('')}
        duration={3000}
        style={{ backgroundColor: '#202124', borderRadius: 8 }}
        action={{
          label: 'Đóng',
          textColor: '#1A73E8',
          onPress: () => setSnackbarMessage(''),
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 14 }}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 10,
    zIndex: 10,
  },
  contentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#E8EAED',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontWeight: '900',
    color: '#1A73E8',
    marginBottom: 8,
    fontSize: 28,
  },
  subtitle: {
    color: '#5F6368',
    textAlign: 'center',
    fontSize: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  inputOutline: {
    borderRadius: 16,
    borderWidth: 1.5,
  },
  registerBtn: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#1A73E8',
  },
  registerBtnLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default RegisterScreen;
