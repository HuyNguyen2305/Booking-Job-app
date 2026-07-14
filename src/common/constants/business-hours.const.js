import 'dotenv/config';
import { IANAZone } from 'luxon';

export const BUSINESS_TZ = process.env.BUSINESS_TZ ?? 'Asia/Ho_Chi_Minh';

if (!IANAZone.isValidZone(BUSINESS_TZ)) {
  throw new Error(`Invalid BUSINESS_TZ configured: "${BUSINESS_TZ}" is not a recognized IANA timezone`);
}

export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 17;
export const WEEKLY_HOURS_CAP = 40;
