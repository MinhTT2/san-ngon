import { z } from 'zod';
import { sportSchema } from './tournaments';
export const skillLabels: Record<string, string> = { beginner: 'Mới chơi', intermediate: 'Trung bình', advanced: 'Nâng cao' };
export type CommunityProfile = {
  user_id: string; display_name: string; phone: string; location: string; sport: string; skill_level: string;
  bio: string; facebook_url: string; zalo_phone: string; is_public: boolean; show_phone: boolean; show_zalo: boolean; show_facebook: boolean; usual_play_times: string; avatar_url: string | null;
};
export const communitySchema = z.object({
  display_name: z.string().trim().min(2).max(100), phone: z.string().trim().min(10).max(25),
  location: z.string().trim().min(2).max(200), sport: sportSchema, skill_level: z.enum(['beginner','intermediate','advanced']),
  bio: z.string().trim().max(1000), facebook_url: z.string().trim().max(300).regex(/^(?:https:\/\/(?:www\.)?facebook\.com\/\S+)?$/),
  zalo_phone: z.string().trim().max(25), is_public: z.boolean(), show_phone: z.boolean(), show_zalo: z.boolean(), show_facebook: z.boolean(), usual_play_times: z.string().trim().max(300),
});
