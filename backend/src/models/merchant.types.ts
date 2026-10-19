export interface MerchantProfile {
  id: string;
  user_id: string;
  cafe_name: string;
  address?: string | null;
  description?: string | null;
  phone?: string | null;
  logo?: string | null;
  banner_url?: string | null;
  qr_code_token: string;
  qr_code_data_url?: string | null;
  is_verified: boolean;
  reward_points: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface MerchantPromo {
  id: string;
  merchant_id: string;
  title: string;
  description: string;
  discount?: string | null;
  image_url?: string | null;
  valid_until: string | Date;
  is_active: boolean;
  created_at: string | Date;
}

export interface MerchantCheckin {
  id: string;
  merchant_id: string;
  user_id: string;
  username?: string | null;
  points: number;
  note?: string | null;
  created_at: string | Date;
}

export interface MerchantDashboardStats {
  totalCheckins: number;
  todayCheckins: number;
  totalPointsGiven: number;
  uniqueVisitors: number;
  activePromosCount: number;
}

export interface MerchantDashboardData {
  profile: MerchantProfile;
  stats: MerchantDashboardStats;
  recentCheckins: MerchantCheckin[];
  promos: MerchantPromo[];
  qrCodeDataUrl: string;
  standingTableUrl: string;
}
