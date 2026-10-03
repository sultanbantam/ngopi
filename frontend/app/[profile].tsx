import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { API_URL, getAuthHeaders } from '../src/utils/api';
import { profileSlug, rememberProfile } from '../src/utils/profileLink';
import { coffee } from '../src/theme/coffee';

type Profile = { id: string; username: string; display_name: string };
export default function ProfileLinkScreen() {
  const { profile } = useLocalSearchParams<{ profile: string }>();
  const [matches, setMatches] = useState<Profile[]>([]);
  const [message, setMessage] = useState('Membuka profil…');
  const [loading, setLoading] = useState(true);
  const openChat = (user: Profile) => router.replace({ pathname: '/(main)/chat/[id]', params: { id: user.id, name: user.display_name } });
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const slug = profileSlug(String(profile || ''));
        const headers = await getAuthHeaders();
        if (!active) return;
        if (!headers.Authorization) {
          await rememberProfile(slug);
          router.replace('/(auth)/login');
          return;
        }
        const response = await axios.get<Profile[]>(`${API_URL}/auth/users`, { headers });
        if (!active) return;
        const found = response.data.filter(user => profileSlug(user.display_name || user.username) === slug);
        if (found.length === 1) { openChat(found[0]!); return; }
        setMatches(found);
        setMessage(found.length ? 'Ada beberapa akun dengan nama ini. Pilih berdasarkan username:' : 'Profil tidak ditemukan. Nama pemilik mungkin sudah berubah.');
      } catch {
        if (active) setMessage('Profil belum bisa dibuka. Coba muat ulang halaman.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [profile]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: coffee.background }} contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 560, gap: 16 }}>
        <Text style={{ color: coffee.text, fontSize: 22, fontWeight: '700' }}>Profil Ngopi</Text>
        {loading && <ActivityIndicator color={coffee.accent} />}
        <Text style={{ color: coffee.text }}>{message}</Text>
        {matches.map(user => <TouchableOpacity key={user.id} onPress={() => openChat(user)} style={{ padding: 16, borderRadius: 12, backgroundColor: coffee.surface }}>
          <Text style={{ color: coffee.text }}>{user.display_name}</Text>
          <Text style={{ color: coffee.accent }}>@{user.username}</Text>
        </TouchableOpacity>)}
        <TouchableOpacity onPress={() => router.replace('/(main)/warkop')} style={{ paddingVertical: 16 }}>
          <Text style={{ color: coffee.accent }}>← Kembali ke Warung Kopi</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
