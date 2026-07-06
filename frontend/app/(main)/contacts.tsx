import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform, Modal, TextInput, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';
import * as ImagePicker from 'expo-image-picker';

import axios from 'axios';

const API_URL = 'https://api.bamboochat.click/api';

export default function ContactsScreen() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentBmcId, setCurrentBmcId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');

  // Modals state
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isWalletModalVisible, setWalletModalVisible] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  
  const [isGroupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMinBmc, setGroupMinBmc] = useState('0');

  // Profile Modal State
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const init = async () => {
      await socketService.connect();
      
      let user = '';
      let userId = '';
      let token = '';
      if (Platform.OS === 'web') {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoToken = urlParams.get('sso_token');
        const ssoUsername = urlParams.get('sso_username');
        const ssoUserId = urlParams.get('sso_userid');
        
        if (ssoToken && ssoUsername && ssoUserId) {
          localStorage.setItem('token', ssoToken);
          localStorage.setItem('username', ssoUsername);
          localStorage.setItem('userId', ssoUserId);
          window.history.replaceState({}, document.title, window.location.pathname);
          token = ssoToken;
          user = ssoUsername;
          userId = ssoUserId;
        } else {
          user = localStorage.getItem('username') || '';
          userId = localStorage.getItem('userId') || '';
          token = localStorage.getItem('token') || '';
        }
      } else {
        user = (await SecureStore.getItemAsync('username')) || '';
        userId = (await SecureStore.getItemAsync('userId')) || '';
        token = (await SecureStore.getItemAsync('token')) || '';
      }
      setCurrentUser(user);
      setCurrentUsername(user);
      setCurrentUserId(userId);

      // Fetch users and groups
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [usersRes, groupsRes] = await Promise.all([
          axios.get(`${API_URL}/auth/users`, { headers }),
          axios.get(`${API_URL}/groups`, { headers })
        ]);
        
        const allUsers = usersRes.data;
        setContacts(allUsers.filter((u: any) => u.id !== userId));
        setGroups(groupsRes.data);

        const me = allUsers.find((u: any) => u.id === userId);
        if (me) {
          setCurrentUser(me.display_name);
          setCurrentUsername(me.username);
          setCurrentBmcId(me.bmc_id?.toString() || '');
          setEditDisplayName(me.display_name);
          setEditBio(me.bio || '');
          setEditStatus(me.status || '');
          setEditAvatar(me.avatar_url || '');
          setCurrentAvatarUrl(me.avatar_url || '');
        }
      } catch (e) {
        console.error('Failed to fetch data', e);
      }

      if (socketService.socket) {
        socketService.socket.on('receive_message', (data: any) => {
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_id || data.sender_id]: (prev[data.room_id || data.sender_id] || 0) + 1
          }));

          // Trigger Web Notification jika tab sedang disembunyikan
          if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
             new Notification('BambooChat: Pesan Baru', {
               body: 'Anda menerima pesan baru dari kontak Anda.',
               icon: '/favicon.ico'
             });
          }
        });
      }

      setLoading(false);
    };

    init();

    return () => {
      if (socketService.socket) {
        socketService.socket.off('receive_message');
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  const openChat = (id: string, name: string) => {
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
    router.push({ pathname: '/(main)/chat/[id]', params: { id, name } });
  };

  const handleLogout = async () => {
    socketService.disconnect();
    if (Platform.OS === 'web') {
      localStorage.clear();
    } else {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('temp_key');
      await SecureStore.deleteItemAsync('username');
    }
    router.replace('/(auth)/login');
  };

  const saveWalletAddress = async () => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      await axios.post(`${API_URL}/auth/profile`, { wallet_address: walletAddress }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWalletModalVisible(false);
      if (Platform.OS === 'web') alert('Wallet Address Saved!');
      else Alert.alert('Success', 'Wallet Address Saved!');
    } catch (e) {
      console.error(e);
      if (Platform.OS === 'web') alert('Failed to save wallet address');
      else Alert.alert('Error', 'Failed to save wallet address');
    }
  };

  const saveProfile = async () => {
    try {
      setIsSavingProfile(true);
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      
      let finalAvatarUrl = editAvatar;
      if (editAvatar && (editAvatar.startsWith('blob:') || editAvatar.startsWith('file:'))) {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const res = await fetch(editAvatar);
          const blob = await res.blob();
          formData.append('file', blob, 'avatar.jpg');
        } else {
          formData.append('file', {
            uri: editAvatar,
            name: 'avatar.jpg',
            type: 'image/jpeg',
          } as any);
        }
        const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalAvatarUrl = uploadRes.data.url;
      }

      const res = await axios.post(`${API_URL}/auth/profile`, { 
        display_name: editDisplayName, 
        bio: editBio, 
        status: editStatus, 
        avatar_url: finalAvatarUrl 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(res.data.user.display_name);
      setCurrentAvatarUrl(res.data.user.avatar_url);
      setProfileModalVisible(false);
      if (Platform.OS === 'web') alert('Profile Saved!');
      else Alert.alert('Success', 'Profile Saved!');
    } catch (e) {
      console.error(e);
      if (Platform.OS === 'web') alert('Failed to save profile');
      else Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const createGroup = async () => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const res = await axios.post(`${API_URL}/groups`, { name: groupName, minBmcBalance: groupMinBmc }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups([...groups, res.data]);
      setGroupModalVisible(false);
      setGroupName('');
      setGroupMinBmc('0');
    } catch (e) {
      console.error(e);
    }
  };

  const joinGroup = async (group: any) => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      await axios.post(`${API_URL}/groups/${group.id}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      openChat(group.id, group.name);
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || 'Failed to join group';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Access Denied', errorMsg);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 50 }}>
          <TouchableOpacity onPress={() => setDropdownVisible(!dropdownVisible)}>
            <View style={styles.avatar}>
              {currentAvatarUrl ? (
                <Image source={{ uri: currentAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{currentUser.charAt(0) || 'U'}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View>
            <TouchableOpacity onPress={() => setDropdownVisible(!dropdownVisible)}>
              <Text style={styles.greeting}>Halo, {currentUser} ▾</Text>
            </TouchableOpacity>
            {dropdownVisible && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setDropdownVisible(false); setProfileModalVisible(true); }}>
                  <Text style={styles.dropdownItemText}>👤 Profil Saya</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { setDropdownVisible(false); setWalletModalVisible(true); }}>
                  <Text style={styles.dropdownItemText}>⚙️ Atur Alamat Dompet</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'contacts' && styles.activeTab]} onPress={() => setActiveTab('contacts')}>
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'groups' && styles.activeTab]} onPress={() => setActiveTab('groups')}>
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>Groups</Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'contacts' ? (
        <FlatList
          data={contacts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.contactItem} onPress={() => openChat(item.id, item.display_name)}>
              <View style={styles.avatar}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{item.display_name.charAt(0)}</Text>
                )}
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.display_name}</Text>
                <Text style={styles.usernameTag}>@{item.username}{item.bmc_id ? `_bmc${item.bmc_id}` : ''}</Text>
                {item.status ? <Text style={styles.contactStatus}>{item.status}</Text> : null}
              </View>
              {unreadCounts[item.id] > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCounts[item.id]}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.createGroupBtn} onPress={() => setGroupModalVisible(true)}>
            <Text style={styles.createGroupBtnText}>+ Create New Group</Text>
          </TouchableOpacity>
          <FlatList
            data={groups}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.contactItem} onPress={() => joinGroup(item)}>
                <View style={[styles.avatar, { backgroundColor: '#3B82F6' }]}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactUsername}>Min Balance: {item.min_bmc_balance} BMC</Text>
                </View>
                <View style={styles.lockBadge}>
                  <Text style={styles.lockBadgeText}>🔒</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Profile Modal */}
      <Modal visible={isProfileModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 32, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155' }]}>
            <Text style={[styles.modalTitle, { fontSize: 24, textAlign: 'center', marginBottom: 24, color: '#10B981' }]}>My Profile</Text>
            
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={pickImage} style={{ alignItems: 'center' }}>
                <View style={[styles.avatar, { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#10B981' }]}>
                  {editAvatar ? (
                    <Image source={{ uri: editAvatar }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                  ) : (
                    <Text style={[styles.avatarText, { fontSize: 40 }]}>{editDisplayName.charAt(0) || 'U'}</Text>
                  )}
                </View>
                <Text style={{ color: '#94A3B8', marginTop: 12, fontWeight: 'bold', fontSize: 14 }}>Tap to Change Photo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput style={styles.inputField} placeholder="Enter your display name" placeholderTextColor="#64748b" value={editDisplayName} onChangeText={setEditDisplayName} />
            
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput style={styles.inputField} placeholder="A short bio about you" placeholderTextColor="#64748b" value={editBio} onChangeText={setEditBio} />
            
            <Text style={styles.inputLabel}>Status</Text>
            <TextInput style={styles.inputField} placeholder="e.g. Online, Busy, At Work" placeholderTextColor="#64748b" value={editStatus} onChangeText={setEditStatus} />
            
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={[styles.cancelBtn, { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 20 }]}>
                <Text style={[styles.cancelBtnText, { color: '#fff' }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Simpan Perubahan</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Modal */}
      <Modal visible={isWalletModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bamboochain Wallet</Text>
            <Text style={styles.modalDesc}>Enter your BEP20 Wallet Address to access Token-Gated groups.</Text>
            <TextInput
              style={styles.input}
              placeholder="0x..."
              placeholderTextColor="#64748b"
              value={walletAddress}
              onChangeText={setWalletAddress}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setWalletModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveWalletAddress} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={isGroupModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Token-Gated Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Group Name"
              placeholderTextColor="#64748b"
              value={groupName}
              onChangeText={setGroupName}
            />
            <TextInput
              style={styles.input}
              placeholder="Minimum BMC Balance (e.g. 100)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={groupMinBmc}
              onChangeText={setGroupMinBmc}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setGroupModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createGroup} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0F172A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  greeting: {
    fontSize: 18,
    color: '#F8FAFC',
    fontWeight: 'bold',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 30,
    left: 0,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 160,
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownItemText: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  walletText: {
    color: '#10B981',
    fontSize: 14,
    marginTop: 4,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10B981',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#10B981',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '600',
    marginBottom: 4,
  },
  usernameTag: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  contactStatus: {
    fontSize: 12,
    color: '#10B981',
  },
  contactUsername: {
    fontSize: 14,
    color: '#64748b',
  },
  contactBio: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lockBadge: {
    backgroundColor: '#334155',
    borderRadius: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadgeText: {
    fontSize: 16,
  },
  createGroupBtn: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  createGroupBtnText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDesc: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 16,
  },
  inputField: {
    backgroundColor: '#1E293B',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 16,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: 12,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#10B981',
    padding: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
