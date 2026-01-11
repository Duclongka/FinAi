
import React from 'react';
import { JarType, JarInfo } from './types';

export const JAR_CONFIG: Record<JarType, JarInfo> = {
  [JarType.NEC]: {
    type: JarType.NEC,
    name: 'Thiết yếu',
    description: 'Dành cho các khoản chi tiêu cần thiết hàng tháng như tiền thuê nhà, hóa đơn điện nước, thực phẩm, và các chi phí sinh hoạt khác. Đây là hũ chiếm tỷ lệ cao nhất, đảm bảo bạn có thể duy trì mức sống ổn định.',
    ratio: 0.55,
    color: '#ef4444', // Red
    icon: '🏠',
  },
  [JarType.LTS]: {
    type: JarType.LTS,
    name: 'Tiết kiệm dài hạn',
    description: 'Dùng để tiết kiệm cho các mục tiêu lớn trong tương lai như mua nhà, mua xe hoặc du lịch. Hũ này giúp bạn chuẩn bị cho những khoản chi lớn và tạo dựng quỹ dự phòng.',
    ratio: 0.10,
    color: '#3b82f6', // Blue
    icon: '🏦',
  },
  [JarType.EDU]: {
    type: JarType.EDU,
    name: 'Giáo dục',
    description: 'Dành cho việc đầu tư vào tri thức và kỹ năng, giúp nâng cao giá trị bản thân và phát triển sự nghiệp.',
    ratio: 0.10,
    color: '#f59e0b', // Amber
    icon: '📚',
  },
  [JarType.PLAY]: {
    type: JarType.PLAY,
    name: 'Hưởng thụ',
    description: 'Dùng cho các khoản chi tiêu giải trí như đi du lịch, xem phim, mua sắm, giúp bạn tận hưởng cuộc sống.',
    ratio: 0.10,
    color: '#ec4899', // Pink
    icon: '🎬',
  },
  [JarType.FFA]: {
    type: JarType.FFA,
    name: 'Tự do tài chính',
    description: 'Dành cho các khoản đầu tư nhằm tăng thu nhập, giúp bạn đạt được tự do tài chính trong tương lai.',
    ratio: 0.10,
    color: '#10b981', // Emerald
    icon: '📈',
  },
  [JarType.GIVE]: {
    type: JarType.GIVE,
    name: 'Từ thiện',
    description: 'Dùng để ủng hộ các tổ chức từ thiện hoặc đóng góp vào các hoạt động xã hội, giúp bạn tạo ra giá trị cho cộng đồng.',
    ratio: 0.05,
    color: '#8b5cf6', // Violet
    icon: '🎁',
  },
};
