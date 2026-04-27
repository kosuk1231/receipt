/**
 * 열매똑똑 수령증 시스템 - Google Apps Script 백엔드
 *
 * 스프레드시트 ID: 1j197FGSPWHZgPrrrss7rnQkxbH8_1PDP8Z8gqddP03s
 * 서명 이미지 Google Drive 폴더 ID: 1lKysHlPwmEueFy-imeXqJ8Sr6zm8dPiy
 *
 * 배포 방법:
 * 1. https://script.google.com 접속 → 새 프로젝트
 * 2. 이 코드를 전체 복사해서 Code.gs 에 붙여넣기
 * 3. 좌측 함수 목록에서 setup 선택 → ▶ 실행 (시트 자동 생성, 권한 승인 1회 필요)
 * 4. 상단 "배포" → "새 배포" → 유형: 웹 앱
 *    - 다음 사용자로 실행: 나
 *    - 액세스 권한: 모든 사용자
 * 5. 발급된 "웹 앱 URL" 을 .env 의 VITE_APPS_SCRIPT_URL 에 입력
 */

const SHEET_ID = '1j197FGSPWHZgPrrrss7rnQkxbH8_1PDP8Z8gqddP03s';
const DRIVE_FOLDER_ID = '1lKysHlPwmEueFy-imeXqJ8Sr6zm8dPiy';

const SHEET_NAMES = {
  hackathon: '해커톤_상품수령',
  sharing: '성과공유_답례품수령',
};

const HEADERS = ['타임스탬프', '수령증종류', '성명', '기관명', '구분', '상품', '서명(이미지)', 'IP'];

function doGet(e) {
  try {
    const action = e?.parameter?.action || 'list';
    const type = e?.parameter?.type;

    if (action === 'list') {
      if (!type || !SHEET_NAMES[type]) {
        return jsonResponse({ ok: false, error: 'invalid type' });
      }
      return jsonResponse({ ok: true, records: listRecords(type) });
    }

    if (action === 'listAll') {
      const all = {};
      Object.keys(SHEET_NAMES).forEach((key) => {
        all[key] = listRecords(key);
      });
      return jsonResponse({ ok: true, records: all });
    }

    return jsonResponse({ ok: false, error: 'unknown action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { type, name, org, division, item, signature } = data;

    if (!type || !SHEET_NAMES[type]) {
      return jsonResponse({ ok: false, error: 'invalid type' });
    }
    if (!name || !signature) {
      return jsonResponse({ ok: false, error: 'missing required fields' });
    }

    const sheet = getOrCreateSheet(type);

    // 중복 서명 체크
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const names = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
      if (names.includes(name)) {
        return jsonResponse({
          ok: false,
          error: 'already_signed',
          message: name + '님은 이미 서명을 제출하셨습니다.',
        });
      }
    }

    const timestamp = new Date();

    // ── 1) 서명 이미지를 Google Drive 폴더에 PNG로 저장 ──
    let driveFileUrl = '';
    try {
      const fileInfo = saveSignatureToDrive(signature, name, type, timestamp);
      driveFileUrl = fileInfo.url;
    } catch (imgErr) {
      Logger.log('Drive 이미지 저장 실패: ' + String(imgErr));
    }

    // ── 2) 스프레드시트에 행 추가 (서명 열은 임시 빈값) ──
    const row = [
      timestamp,
      type === 'hackathon' ? '해커톤 상품 수령증' : '성과공유 답례품 수령증',
      name,
      org || '',
      division || '',
      item || '',
      '', // 서명 열 - 아래에서 이미지로 설정
      '',
    ];

    sheet.appendRow(row);
    const newLastRow = sheet.getLastRow();

    // ── 3) 서명 셀에 CellImage로 이미지 삽입 ──
    if (driveFileUrl) {
      try {
        const cellImage = SpreadsheetApp.newCellImage()
          .setSourceUrl(driveFileUrl)
          .setAltTextTitle('서명_' + name)
          .setAltTextDescription(type + ' 서명 - ' + name)
          .build();
        sheet.getRange(newLastRow, 7).setValue(cellImage);
      } catch (cellImgErr) {
        // CellImage 실패 시 IMAGE 수식으로 폴백
        Logger.log('CellImage 실패, IMAGE 수식 사용: ' + String(cellImgErr));
        sheet.getRange(newLastRow, 7).setFormula('=IMAGE("' + driveFileUrl + '")');
      }
    } else {
      // Drive 저장 실패 시 DataURL 텍스트로 저장
      sheet.getRange(newLastRow, 7).setValue(signature);
    }

    // 행 높이를 이미지가 보일 수 있도록 설정
    sheet.setRowHeightsForced(newLastRow, 1, 80);

    return jsonResponse({
      ok: true,
      timestamp: timestamp.toISOString(),
      name: name,
      item: item,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * 서명 DataURL을 PNG 파일로 변환하여 Google Drive 폴더에 저장
 * @param {string} dataUrl - base64 DataURL (image/png)
 * @param {string} name - 서명자 이름
 * @param {string} type - 수령증 종류 (hackathon / sharing)
 * @param {Date} timestamp - 타임스탬프
 * @returns {Object} { fileId, url } - Drive 파일 ID와 공개 이미지 URL
 */
function saveSignatureToDrive(dataUrl, name, type, timestamp) {
  // DataURL에서 base64 데이터 추출
  const base64Data = dataUrl.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    'image/png',
    formatFileName(name, type, timestamp)
  );

  // 지정된 Google Drive 폴더에 파일 저장
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const file = folder.createFile(blob);

  // 파일을 누구나 볼 수 있도록 공유 설정 (스프레드시트에서 이미지 접근 가능하도록)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  // Google Drive에서 직접 제공하는 썸네일 URL (스프레드시트 IMAGE/CellImage에서 가장 안정적)
  const imageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

  return { fileId: fileId, url: imageUrl };
}

/**
 * 파일명 생성
 */
function formatFileName(name, type, timestamp) {
  const dateStr = Utilities.formatDate(timestamp, 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  const typeLabel = type === 'hackathon' ? '해커톤' : '성과공유';
  return '서명_' + typeLabel + '_' + name + '_' + dateStr + '.png';
}

function getOrCreateSheet(type) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = SHEET_NAMES[type];
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(HEADERS);
    formatHeader(sheet);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    formatHeader(sheet);
  }
  return sheet;
}

function formatHeader(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#1c1917');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 240);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 300);  // 이미지 열 폭 확대
  sheet.setColumnWidth(8, 120);
}

function listRecords(type) {
  const sheet = getOrCreateSheet(type);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  return values.map(function (row) {
    return {
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      receiptType: row[1],
      name: row[2],
      org: row[3],
      division: row[4],
      item: row[5],
    };
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * 초기 설정 - 한 번 실행하면 두 시트가 헤더와 함께 생성됨
 * (Apps Script 편집기에서 함수 선택 후 ▶ 버튼)
 */
function setup() {
  Object.keys(SHEET_NAMES).forEach(function (type) {
    getOrCreateSheet(type);
  });

  // Drive 폴더 접근 확인
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    Logger.log('✅ Drive 폴더 확인: ' + folder.getName());
  } catch (e) {
    Logger.log('⚠️ Drive 폴더 접근 실패 - 폴더 ID를 확인해주세요: ' + DRIVE_FOLDER_ID);
  }

  Logger.log('Setup complete: 시트가 생성되었습니다.');
}
