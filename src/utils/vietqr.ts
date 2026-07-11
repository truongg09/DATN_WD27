// Sinh chuỗi VietQR chuẩn EMVCo (NAPAS 247) — quét được bằng mọi app ngân hàng VN.
// Tham khảo: đặc tả QR NAPAS / VietQR (dịch vụ chuyển nhanh tới tài khoản: QRIBFTTA).

export interface VietQrBank {
  bin: string;
  code: string;
  name: string;
  shortName: string;
}

export const VIETQR_BANKS: VietQrBank[] = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank - NH TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank' },
  { bin: '970415', code: 'ICB', name: 'VietinBank - NH TMCP Công thương Việt Nam', shortName: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV - NH TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
  { bin: '970405', code: 'VBA', name: 'Agribank - NH Nông nghiệp và PTNT Việt Nam', shortName: 'Agribank' },
  { bin: '970407', code: 'TCB', name: 'Techcombank - NH TMCP Kỹ thương Việt Nam', shortName: 'Techcombank' },
  { bin: '970422', code: 'MB', name: 'MB Bank - NH TMCP Quân đội', shortName: 'MB Bank' },
  { bin: '970416', code: 'ACB', name: 'ACB - NH TMCP Á Châu', shortName: 'ACB' },
  { bin: '970432', code: 'VPB', name: 'VPBank - NH TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
  { bin: '970423', code: 'TPB', name: 'TPBank - NH TMCP Tiên Phong', shortName: 'TPBank' },
  { bin: '970403', code: 'STB', name: 'Sacombank - NH TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { bin: '970441', code: 'VIB', name: 'VIB - NH TMCP Quốc tế Việt Nam', shortName: 'VIB' },
  { bin: '970426', code: 'MSB', name: 'MSB - NH TMCP Hàng Hải', shortName: 'MSB' },
  { bin: '970443', code: 'SHB', name: 'SHB - NH TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
  { bin: '970448', code: 'OCB', name: 'OCB - NH TMCP Phương Đông', shortName: 'OCB' },
  { bin: '970440', code: 'SEAB', name: 'SeABank - NH TMCP Đông Nam Á', shortName: 'SeABank' },
  { bin: '970437', code: 'HDB', name: 'HDBank - NH TMCP Phát triển TP.HCM', shortName: 'HDBank' },
  { bin: '970431', code: 'EIB', name: 'Eximbank - NH TMCP Xuất nhập khẩu Việt Nam', shortName: 'Eximbank' },
  { bin: '970449', code: 'LPB', name: 'LPBank - NH TMCP Lộc Phát Việt Nam', shortName: 'LPBank' },
  { bin: '970429', code: 'SCB', name: 'SCB - NH TMCP Sài Gòn', shortName: 'SCB' },
  { bin: '970419', code: 'NCB', name: 'NCB - NH TMCP Quốc Dân', shortName: 'NCB' },
  { bin: '970425', code: 'ABB', name: 'ABBANK - NH TMCP An Bình', shortName: 'ABBANK' },
  { bin: '970428', code: 'NAB', name: 'Nam A Bank - NH TMCP Nam Á', shortName: 'Nam A Bank' },
  { bin: '970412', code: 'PVCB', name: 'PVcomBank - NH TMCP Đại Chúng Việt Nam', shortName: 'PVcomBank' },
  { bin: '970427', code: 'VAB', name: 'VietABank - NH TMCP Việt Á', shortName: 'VietABank' },
  { bin: '970438', code: 'BVB', name: 'BaoViet Bank - NH TMCP Bảo Việt', shortName: 'BaoViet Bank' },
  { bin: '970454', code: 'VCCB', name: 'BVBank - NH TMCP Bản Việt', shortName: 'BVBank' },
  { bin: '970452', code: 'KLB', name: 'KienlongBank - NH TMCP Kiên Long', shortName: 'KienlongBank' },
  { bin: '970406', code: 'DOB', name: 'DongA Bank - NH TMCP Đông Á', shortName: 'DongA Bank' },
  { bin: '970430', code: 'PGB', name: 'PGBank - NH TMCP Thịnh vượng và Phát triển', shortName: 'PGBank' },
  { bin: '970424', code: 'SHBVN', name: 'Shinhan Bank Việt Nam', shortName: 'Shinhan Bank' },
  { bin: '546034', code: 'CAKE', name: 'CAKE by VPBank - NH số CAKE', shortName: 'CAKE' },
  { bin: '963388', code: 'TIMO', name: 'Timo - NH số Timo (BVBank)', shortName: 'Timo' },
];

export const findBankByBin = (bin: string): VietQrBank | undefined =>
  VIETQR_BANKS.find((bank) => bank.bin === bin);

// Bỏ dấu tiếng Việt + ký tự đặc biệt để nội dung chuyển khoản an toàn với mọi ngân hàng
export const toTransferText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) theo yêu cầu của EMVCo
const crc16 = (input: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

// Trường TLV: ID (2 ký tự) + độ dài (2 chữ số) + giá trị
const tlv = (id: string, value: string): string =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

export interface VietQrPayload {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  addInfo?: string;
}

export const buildVietQrPayload = ({ bankBin, accountNumber, amount, addInfo }: VietQrPayload): string => {
  const beneficiary = tlv('00', bankBin) + tlv('01', accountNumber);
  const merchantAccount =
    tlv('00', 'A000000727') + // AID của NAPAS
    tlv('01', beneficiary) +
    tlv('02', 'QRIBFTTA'); // chuyển nhanh tới tài khoản

  let payload =
    tlv('00', '01') + // phiên bản dữ liệu
    tlv('01', amount && amount > 0 ? '12' : '11') + // 12 = QR động (có số tiền), 11 = QR tĩnh
    tlv('38', merchantAccount) +
    tlv('53', '704'); // tiền tệ VND

  if (amount && amount > 0) {
    payload += tlv('54', String(Math.round(amount)));
  }

  payload += tlv('58', 'VN');

  const purpose = addInfo ? toTransferText(addInfo).slice(0, 25) : '';
  if (purpose) {
    payload += tlv('62', tlv('08', purpose));
  }

  payload += '6304';
  return payload + crc16(payload);
};
