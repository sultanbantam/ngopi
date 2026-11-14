import type { MerchantReviewStatus } from '@prisma/client';

export type { MerchantReviewStatus };

export interface SupportingDocsMetadata {
  reference_note?: string;
  nib?: string;
  document_url?: string;
  instagram?: string;
  [key: string]: string | undefined;
}

export interface MerchantProfile {
  id: string;
  user_id?: string | null;
  cafe_name: string;
  business_category?: string | null;
  address?: string | null;
  description?: string | null;
  phone?: string | null;
  logo?: string | null;
  banner_url?: string | null;
  supporting_docs?: SupportingDocsMetadata | null;
  qr_code_token: string;
  qr_code_data_url?: string | null;
  is_verified: boolean;
  review_status?: MerchantReviewStatus;
  is_showcase?: boolean;
  reward_points: number;
  submitted_at?: string | Date;
  reviewed_by?: string | null;
  reviewed_at?: string | Date | null;
  rejection_reason?: string | null;
  deleted_at?: string | Date | null;
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
