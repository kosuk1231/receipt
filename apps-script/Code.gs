/**
 * 열매똑똑 수령증 시스템 - Google Apps Script 백엔드
 *
 * 스프레드시트 ID: 1j197FGSPWHZgPrrrss7rnQkxbH8_1PDP8Z8gqddP03s
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

const SHEET_NAMES = {
  hackathon: '해커톤_상품수령',
  sharing: '성과공유_답례품수령',
};

const HEADERS = ['타임스탬프', '수령증종류', '성명', '기관명', '구분', '상품', '서명(DataURL)', 'IP'];

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
    const row = [
      timestamp,
      type === 'hackathon' ? '해커톤 상품 수령증' : '성과공유 답례품 수령증',
      name,
      org || '',
      division || '',
      item || '',
      signature,
      '',
    ];

    sheet.appendRow(row);

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
  sheet.setColumnWidth(7, 200);
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
  Logger.log('Setup complete: 시트가 생성되었습니다.');
}
