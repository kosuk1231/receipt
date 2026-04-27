# 열매똑똑 수령증 시스템

서울특별시사회복지사협회 디지털 역량강화사업 수령증 웹앱
**Google Sheets 연동 + 오프라인 대비**

## 데이터 저장 전략 (이중 저장)

```
서명 제출
   ├─→ ① 즉시 localStorage 저장 (오프라인에서도 동작)
   └─→ ② 동시에 Google Sheets로 백그라운드 전송
            ├─ 성공: 동기화 완료
            └─ 실패: 큐에 적재 → 자동 재시도
```

### 동작 시나리오

| 상황 | 동작 |
|------|------|
| 온라인 정상 | 즉시 시트에 저장. 완료 화면에 "스프레드시트에 정상 저장" 표시 |
| 일시적 네트워크 오류 | 로컬 저장 + 큐 적재. 30초 후 자동 재시도 |
| 완전 오프라인 | 로컬 저장만. 온라인 복귀 시 자동 전송 |
| 새로 접속한 사용자 | 시트에서 명단 가져와서 캐시 |

### 자동 동기화 트리거
- 페이지 로딩 시 (큐가 있으면)
- 오프라인 → 온라인 전환 시 (브라우저 이벤트 감지)
- 30초마다 (앱이 켜져 있는 동안)
- 사용자가 직접 "재전송" 버튼 클릭

## 스프레드시트 구조

**Spreadsheet ID**: `1j197FGSPWHZgPrrrss7rnQkxbH8_1PDP8Z8gqddP03s`

자동 생성되는 시트:
- `해커톤_상품수령` — 9명 본선 진출자
- `성과공유_답례품수령` — 4명 사례발표자

각 시트의 컬럼:

| 타임스탬프 | 수령증종류 | 성명 | 기관명 | 구분 | 상품 | 서명(DataURL) | IP |

## 배포 절차

### 1단계: Google Apps Script 배포 (필수, 먼저)

1. https://script.google.com 접속 → **새 프로젝트**
2. 프로젝트 이름을 "열매똑똑 수령증 백엔드" 등으로 변경
3. `apps-script/Code.gs` 파일 내용을 전체 복사해서 `Code.gs` 에 붙여넣기
4. 상단의 **저장(💾)** 버튼 클릭
5. 좌측 함수 목록에서 `setup` 선택 → **▶ 실행** (시트 자동 생성, 권한 승인 1회 필요)
6. 우상단 **배포** → **새 배포**
   - 유형 선택: **웹 앱** (톱니바퀴 → 웹 앱)
   - 설명: `v1` (또는 자유롭게)
   - 다음 사용자로 실행: **나**
   - 액세스 권한: **모든 사용자**
   - **배포** 클릭
7. 발급된 **웹 앱 URL** 을 복사 (`https://script.google.com/macros/s/AKfycb.../exec`)

### 2단계: 환경변수 설정

`.env.example` 파일을 `.env` 로 복사하고 URL 입력:

```bash
cp .env.example .env
```

`.env`:
```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
```

### 3단계: 로컬 실행 또는 Vercel 배포

**로컬 실행:**
```bash
npm install
npm run dev
```

**Vercel 배포:**
1. GitHub 저장소에 push (`.env` 는 `.gitignore` 에 의해 자동 제외됨)
2. Vercel → New Project → 저장소 import
3. **Environment Variables** 섹션에서:
   - Key: `VITE_APPS_SCRIPT_URL`
   - Value: 1단계에서 발급받은 웹 앱 URL
4. Deploy 클릭

## Apps Script 재배포 시 주의

코드를 수정한 뒤에는 반드시:
- **배포 → 배포 관리** → 기존 배포의 ✏️ 편집 → 버전을 **"새 버전"** 으로 변경 → 배포
- 또는 **새 배포** 를 만들고 새 URL을 환경변수에 반영

URL이 바뀌지 않도록 "기존 배포 편집" 을 권장합니다.

## 사용 흐름

1. 홈에서 작성할 수령증 선택
2. 페이지 로딩 시 기존 서명자 자동 조회 (로컬 캐시 + 서버)
3. 드롭다운에서 본인 이름 선택 (이미 서명한 사람은 "서명완료" 라벨 표시)
4. 수령한 상품 확인 (해커톤은 키보드/마우스 중 선택)
5. 명세 카드 확인 후 서명
6. 제출 → localStorage 저장 + 백그라운드 시트 전송
7. 본인 수령 확인서 표시 (동기화 상태 뱃지 포함)

## localStorage 사용 키

- `yeolmae_records_v1` - 본인이 작성한 기록 (확인 화면 재표시용)
- `yeolmae_signed_names_v1` - 마지막으로 조회한 서명자 명단 캐시
- `yeolmae_pending_queue_v1` - 전송 대기 중인 데이터 큐

## 기술 스택

- React 18 + Vite 5
- Tailwind CSS 3
- lucide-react (아이콘)
- Canvas API (서명 패드)
- Google Apps Script (백엔드)
- Google Sheets (데이터 저장소)
- localStorage + Browser online/offline events (오프라인 대응)

## 폴더 구조

```
.
├── apps-script/
│   └── Code.gs              # Google Apps Script 백엔드 (수동 배포)
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx              # 메인 앱 (오프라인 대비 로직 포함)
│   ├── main.jsx             # React 진입점
│   └── index.css            # Tailwind
├── .env.example             # 환경변수 템플릿
├── .gitignore
├── README.md
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

## 트러블슈팅

**Q. "설정이 필요합니다" 화면이 뜹니다**
A. `.env` 파일에 `VITE_APPS_SCRIPT_URL` 이 비어있거나 누락된 경우입니다. URL을 입력하고 `npm run dev` 를 다시 실행하세요. Vercel에서는 환경변수 추가 후 재배포가 필요합니다.

**Q. 노란 "전송 대기" 배너가 사라지지 않습니다**
A. 큐에 쌓인 항목이 모두 시트에 반영되면 배너가 사라집니다. 인터넷 연결을 확인한 뒤 배너의 "재전송" 버튼을 누르세요. 30초 간격으로 자동 재시도도 동작합니다.

**Q. 두 번 서명되었습니다**
A. Apps Script 측에서 동일 이름의 중복을 차단하지만, 만에 하나 발생하면 스프레드시트에서 직접 행을 삭제하면 됩니다. 또한 큐 재전송 시 서버가 `already_signed` 응답을 보내면 클라이언트가 큐에서만 제거하고 시트에는 추가하지 않습니다.

**Q. 사용자 단말기 데이터를 초기화하고 싶을 때**
A. 브라우저 DevTools → Application → Local Storage 에서 `yeolmae_*` 키를 모두 삭제하면 됩니다. 시트에 이미 저장된 데이터는 영향 받지 않습니다.

**Q. 오프라인 상태에서 서명한 데이터가 사라질 위험은?**
A. localStorage는 사용자가 명시적으로 캐시를 지우거나 시크릿 모드를 닫지 않는 한 영속됩니다. 단, 같은 단말기에서 작성하고 동일 단말기에서 인터넷 연결되어야 큐가 동기화됩니다. 다른 기기로 옮기면 큐가 함께 이동하지 않으니 주의하세요.
