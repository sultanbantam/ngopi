import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform, Modal, TextInput, Alert, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { socketService } from '../../src/utils/socket';
import * as SecureStore from '../../src/utils/storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import axios from 'axios';

const API_URL = 'https://api.bamboochat.click/api';

export default function ContactsScreen() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentBmcId, setCurrentBmcId] = useState('');
  const [currentRole, setCurrentRole] = useState('user');
  const [currentUserId, setCurrentUserId] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  const [activeTab, setActiveTab] = useState<'semua' | 'belum_dibaca' | 'favorit' | 'rumpun'>('semua');

  // Modals state
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isWalletModalVisible, setWalletModalVisible] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  
  const [isGroupModalVisible, setGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupMinBmc, setGroupMinBmc] = useState('0');

  // Airdrop Modal
  const [isAirdropModalVisible, setAirdropModalVisible] = useState(false);
  const [airdropData, setAirdropData] = useState<any>(null);

  // Settings Modal
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settings, setSettings] = useState<any>({ hide_name: false, hide_contacts: false, hide_groups: false, preferred_language: 'id' });

  // Profile Modal State
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Online Users State
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

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
        const [usersRes, groupsRes, settingsRes] = await Promise.all([
          axios.get(`${API_URL}/auth/users`, { headers }),
          axios.get(`${API_URL}/groups`, { headers }),
          axios.get(`${API_URL}/settings`, { headers }).catch(() => ({ data: {} }))
        ]);
        
        const allUsers = usersRes.data;
        setContacts(allUsers.filter((u: any) => u.id !== userId));
        setGroups(groupsRes.data);
        if (settingsRes.data) setSettings(settingsRes.data);

        const me = allUsers.find((u: any) => u.id === userId);
        if (me) {
          setCurrentUser(me.display_name);
          setCurrentUsername(me.username);
          setCurrentBmcId(me.bmc_id?.toString() || '');
          setCurrentRole(me.role || 'user');
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

        socketService.socket.on('online_list', (data: any[]) => {
          setOnlineUsers(data.filter(u => u.id !== userId));
        });
        
        socketService.socket.emit('request_online_list');
      }

      setLoading(false);
    };

    init();

    return () => {
      if (socketService.socket) {
        socketService.socket.off('receive_message');
        socketService.socket.off('online_list');
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

  const openHelpCenter = () => {
    router.push('/(main)/help-center' as any);
  };

  const openAdminDashboard = () => {
    router.push('/(main)/admin/dashboard' as any);
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
      const res = await axios.post(`${API_URL}/groups`, { name: groupName, description: groupDescription, minBmcBalance: groupMinBmc }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups([...groups, res.data]);
      setGroupModalVisible(false);
      setGroupName('');
      setGroupDescription('');
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

  const saveSettings = async () => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      await axios.post(`${API_URL}/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettingsModalVisible(false);
      if (Platform.OS === 'web') alert('Settings Saved!');
      else Alert.alert('Success', 'Settings Saved!');
    } catch (e) {
      console.error(e);
      if (Platform.OS === 'web') alert('Failed to save settings');
      else Alert.alert('Error', 'Failed to save settings');
    }
  };

  const loadAirdropData = async () => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const res = await axios.get(`${API_URL}/bmc/airdrop/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAirdropData(res.data);
      setAirdropModalVisible(true);
    } catch (e) {
      console.error(e);
    }
  };

  const claimAirdrop = async () => {
    try {
      let token = Platform.OS === 'web' ? localStorage.getItem('token') : await SecureStore.getItemAsync('token');
      const res = await axios.post(`${API_URL}/bmc/airdrop/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Platform.OS === 'web') alert(res.data.message);
      else Alert.alert('Success', res.data.message);
      loadAirdropData(); // reload data
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.response?.data?.error || 'Failed to claim airdrop';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Error', errorMsg);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const getFilteredList = () => {
    let list: any[] = [];
    if (activeTab === 'semua') {
      if (!settings?.hide_contacts) list.push(...contacts.map(c => ({ ...c, _type: 'contact' })));
      if (!settings?.hide_groups) list.push(...groups.map(g => ({ ...g, _type: 'group' })));
    } else if (activeTab === 'belum_dibaca') {
      if (!settings?.hide_contacts) list.push(...contacts.filter(c => unreadCounts[c.id] > 0).map(c => ({ ...c, _type: 'contact' })));
      if (!settings?.hide_groups) list.push(...groups.filter(g => unreadCounts[g.id] > 0).map(g => ({ ...g, _type: 'group' })));
    } else if (activeTab === 'favorit') {
      // placeholder for favorit
    } else if (activeTab === 'rumpun') {
      if (!settings?.hide_groups) list.push(...groups.map(g => ({ ...g, _type: 'group' })));
    }
    if (activeTab === 'semua') {
      list.unshift({
        _type: 'cs',
        id: 'bamboo-cs',
        display_name: 'BambooCS',
        username: 'support',
        status: 'Online 24/7 untuk semua platform ekosistem',
      });
    }
    return list;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item._type === 'cs') {
      return (
        <TouchableOpacity style={[styles.contactItem, styles.csContactItem]} onPress={openHelpCenter}>
          <View style={[styles.avatar, styles.csAvatar]}>
            <Ionicons name="headset-outline" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>BambooCS</Text>
            <Text style={styles.usernameTag}>@support_hub</Text>
            <Text style={styles.contactStatus}>{item.status}</Text>
          </View>
          <View style={styles.onlineDotSmall} />
        </TouchableOpacity>
      );
    }

    if (item._type === 'group') {
      return (
        <TouchableOpacity style={styles.contactItem} onPress={() => joinGroup(item)}>
          <View style={[styles.avatar, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
            {item.description && <Text style={styles.contactBio}>{item.description}</Text>}
            <Text style={styles.contactUsername}>Min Balance: {item.min_bmc_balance} BMC</Text>
          </View>
          {unreadCounts[item.id] > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCounts[item.id]}</Text>
            </View>
          ) : (
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>🔒</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    } else {
      return (
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
            <Text style={styles.usernameTag}>
              @{item.username}{item.bmc_id === 0 ? '_bmc' : item.bmc_id > 0 ? `_bmc${item.bmc_id}` : ''}
            </Text>
            {item.status ? <Text style={styles.contactStatus}>{item.status}</Text> : null}
          </View>
          {unreadCounts[item.id] > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCounts[item.id]}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }
  };

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
              <Text style={styles.greeting}>Halo, {settings?.hide_name ? 'Anonymous' : currentUser} ▾</Text>
              <Text style={styles.usernameTag}>
                @{currentUsername}{currentBmcId === '0' ? '_bmc' : currentBmcId ? `_bmc${currentBmcId}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => setDropdownVisible(true)}>
          <Text style={styles.logoutText}>☰ Menu</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput style={styles.searchInput} placeholder="Cari atau mulai obrolan baru" placeholderTextColor="#94A3B8" />
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.helpCenterButton} onPress={openHelpCenter}>
          <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.helpCenterButtonText}>Pusat Bantuan</Text>
        </TouchableOpacity>
        {(currentRole === 'admin' || currentRole === 'agent') && (
          <TouchableOpacity style={styles.adminButton} onPress={openAdminDashboard}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#34D399" />
            <Text style={styles.adminButtonText}>CS Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ marginBottom: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          <TouchableOpacity style={[styles.chip, activeTab === 'semua' && styles.activeChip]} onPress={() => setActiveTab('semua')}>
            <Text style={[styles.chipText, activeTab === 'semua' && styles.activeChipText]}>Semua</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab === 'belum_dibaca' && styles.activeChip]} onPress={() => setActiveTab('belum_dibaca')}>
            <Text style={[styles.chipText, activeTab === 'belum_dibaca' && styles.activeChipText]}>Belum dibaca</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab === 'favorit' && styles.activeChip]} onPress={() => setActiveTab('favorit')}>
            <Text style={[styles.chipText, activeTab === 'favorit' && styles.activeChipText]}>Favorit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, activeTab === 'rumpun' && styles.activeChip]} onPress={() => setActiveTab('rumpun')}>
            <Text style={[styles.chipText, activeTab === 'rumpun' && styles.activeChipText]}>Rumpun {groups.length}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {activeTab === 'rumpun' && (
        <TouchableOpacity style={styles.createGroupBtn} onPress={() => setGroupModalVisible(true)}>
          <Text style={styles.createGroupBtnText}>+ Buat Rumpun Baru</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={getFilteredList()}
        keyExtractor={item => item._type + item.id}
        renderItem={renderItem}
      />

      {/* Online Users Horizontal Bar */}
      {onlineUsers.length > 0 && !settings?.hide_contacts && (
        <View style={styles.onlineBar}>
          <Text style={{ color: '#10B981', fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>Online Now</Text>
          <FlatList
            horizontal
            data={onlineUsers}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.onlineUserItem} onPress={() => openChat(item.id, item.display_name)}>
                <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: '#10B981' }]}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{item.display_name.charAt(0)}</Text>
                  )}
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

      {/* Airdrop Modal */}
      <Modal visible={isAirdropModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎁</Text>
            <Text style={[styles.modalTitle, { color: '#10B981' }]}>Daily BMC Airdrop</Text>
            {airdropData && (
              <>
                <Text style={[styles.modalDesc, { textAlign: 'center' }]}>
                  You have claimed a total of <Text style={{ fontWeight: 'bold', color: '#fff' }}>{airdropData.total_claimed.toFixed(2)} BMC</Text> over {airdropData.total_claims} days.
                </Text>
                {airdropData.can_claim_today ? (
                  <TouchableOpacity onPress={claimAirdrop} style={[styles.saveBtn, { width: '100%', alignItems: 'center', marginTop: 10, paddingVertical: 16 }]}>
                    <Text style={[styles.saveBtnText, { fontSize: 18 }]}>Claim {airdropData.daily_amount} BMC Now</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.saveBtn, { width: '100%', alignItems: 'center', marginTop: 10, paddingVertical: 16, backgroundColor: '#334155' }]}>
                    <Text style={[styles.saveBtnText, { fontSize: 18, color: '#94A3B8' }]}>Already Claimed Today</Text>
                  </View>
                )}
              </>
            )}
            <TouchableOpacity onPress={() => setAirdropModalVisible(false)} style={[styles.cancelBtn, { marginTop: 16 }]}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={isSettingsModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Privacy Settings</Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Hide My Name</Text>
              <TouchableOpacity 
                style={[styles.toggleBtn, settings?.hide_name && styles.toggleBtnActive]} 
                onPress={() => setSettings({ ...settings, hide_name: !settings?.hide_name })}
              >
                <View style={[styles.toggleKnob, settings?.hide_name && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Hide Contacts Tab</Text>
              <TouchableOpacity 
                style={[styles.toggleBtn, settings?.hide_contacts && styles.toggleBtnActive]} 
                onPress={() => setSettings({ ...settings, hide_contacts: !settings?.hide_contacts })}
              >
                <View style={[styles.toggleKnob, settings?.hide_contacts && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Hide Rumpun Tab</Text>
              <TouchableOpacity 
                style={[styles.toggleBtn, settings?.hide_groups && styles.toggleBtnActive]} 
                onPress={() => setSettings({ ...settings, hide_groups: !settings?.hide_groups })}
              >
                <View style={[styles.toggleKnob, settings?.hide_groups && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveSettings} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Preferences</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={isGroupModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Buat Rumpun Baru</Text>
            <TextInput
              style={styles.input}
              placeholder="Nama Rumpun"
              placeholderTextColor="#64748b"
              value={groupName}
              onChangeText={setGroupName}
            />
            <TextInput
              style={styles.input}
              placeholder="Deskripsi Singkat (Opsional)"
              placeholderTextColor="#64748b"
              value={groupDescription}
              onChangeText={setGroupDescription}
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
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createGroup} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Buat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dropdownVisible} transparent={true} animationType="slide" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Pengaturan Akun</Text>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); setProfileModalVisible(true); }}>
              <Text style={styles.actionSheetText}>👤 Profil Saya</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); loadAirdropData(); }}>
              <Text style={[styles.actionSheetText, { color: '#10B981' }]}>🎁 Klaim Airdrop BMC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); setWalletModalVisible(true); }}>
              <Text style={styles.actionSheetText}>⚙️ Atur Alamat Dompet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetItem} onPress={() => { setDropdownVisible(false); setSettingsModalVisible(true); }}>
              <Text style={styles.actionSheetText}>🔒 Pengaturan Privasi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomWidth: 0 }]} onPress={() => { setDropdownVisible(false); handleLogout(); }}>
              <Text style={[styles.actionSheetText, { color: '#EF4444' }]}>🚪 Keluar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  actionSheet: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 10,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    marginBottom: 16,
  },
  actionSheetTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  actionSheetItem: {
    width: '100%',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  actionSheetText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '500',
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    color: '#fff',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  helpCenterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  helpCenterButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  adminButtonText: {
    color: '#34D399',
    fontWeight: '800',
  },
  chipsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeChip: {
    backgroundColor: '#064E3B', // dark green
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  activeChipText: {
    color: '#10B981', // bright green
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  csContactItem: {
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: '#0B2A22',
  },
  csAvatar: {
    backgroundColor: '#059669',
  },
  onlineDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginLeft: 8,
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
  },
  toggleBtn: {
    width: 50,
    height: 28,
    backgroundColor: '#334155',
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#10B981',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  onlineBar: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    marginTop: 8,
  },
  onlineUserItem: {
    alignItems: 'center',
  }
});
