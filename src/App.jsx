import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Check,
  Keyboard,
  Mouse,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  FileSignature,
  Award,
  ArrowLeft,
  Coffee,
  Trophy,
  Gift,
  User,
  Lock,
  CheckCircle2,
  Loader2,
  CloudOff,
  Cloud,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

// ============ Config ============
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxPwJywJp1DKt4usoFzJdj3rM47kqluqUUTjVxFVq_4Jdvn1F9xJ4pG9UW3ILDsulOvCw/exec';

// localStorage 키
const LS_KEYS = {
  records: 'yeolmae_records_v1', // 본인이 작성한 기록 (확인 화면 재표시용)
  signedNames: 'yeolmae_signed_names_v1', // 마지막으로 조회한 서명자 명단 (오프라인 캐시)
  pendingQueue: 'yeolmae_pending_queue_v1', // 전송 대기 중인 큐
};

// ============ Receipt Definitions ============
const RECEIPTS = {
  hackathon: {
    id: 'hackathon',
    title: '열매똑똑 해커톤 상품 수령증',
    subtitle: 'Hackathon Awards Receipt',
    program: '디지털 역량강화사업: 열매똑똑 Smart work\n(열매똑똑 해커톤 최종 발표)',
    programShort: '열매똑똑 Smart work · 해커톤 최종 발표',
    date: '2025. 4. 29.(수)',
    dateShort: '2025.04.29 (WED)',
    category: '소프트웨어(AI) · 디지털 장비',
    division: '기타(상품)',
    icon: Trophy,
    accent: '#ff003c',
    goodsLabel: '상품',
    items: [
      { id: 'keyboard', label: '무선 키보드', sub: 'Wireless Keyboard', icon: Keyboard },
      { id: 'mouse', label: '무선 마우스', sub: 'Wireless Mouse', icon: Mouse },
    ],
    participants: [
      { id: 1, name: '김진래', org: '서울장애인종합복지관' },
      { id: 2, name: '최중호', org: '아름드리꿈터' },
      { id: 3, name: '이동규', org: '북서울종합사회복지관' },
      { id: 4, name: '박민준', org: '방화2종합사회복지관' },
      { id: 5, name: '서경은', org: '서울특별시동부노인보호전문기관' },
      { id: 6, name: '박성목', org: '성동구립 송정동노인복지관' },
      { id: 7, name: '천우진', org: '서부장애인종합복지관' },
      { id: 8, name: '이방미', org: '반포종합사회복지관' },
      { id: 9, name: '한미영', org: '동대문구가족센터' },
    ],
  },
  sharing: {
    id: 'sharing',
    title: '성과공유 답례품 수령증',
    subtitle: 'Performance Sharing Receipt',
    program: '디지털 역량강화사업: 열매똑똑 Smart Work 디지털 성과공유\n(2차년도 성과공유회 우수사례 발표)',
    programShort: '열매똑똑 Smart Work · 성과공유회',
    date: '2025. 4. 29.(수)',
    dateShort: '2025.04.29 (WED)',
    category: '스타벅스 기프트카드 (5만원권)',
    division: '기프트카드',
    icon: Gift,
    accent: '#519c90',
    goodsLabel: '답례품',
    items: [{ id: 'starbucks', label: '스타벅스 5만원권', sub: 'Starbucks Gift Card', icon: Coffee }],
    participants: [
      { id: 1, name: '최혜원', org: '서부장애인종합복지관' },
      { id: 2, name: '유승현', org: '다시서기종합지원센터' },
      { id: 3, name: '김지우', org: '(사)서울특별시시각장애인연합회 동작지회' },
      { id: 4, name: '김관영', org: '대치노인복지관' },
    ],
  },
};

// ============ localStorage Helpers ============
function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed', e);
  }
}

// ============ Pending Queue ============
function getPendingQueue() {
  return lsGet(LS_KEYS.pendingQueue, []);
}

function setPendingQueue(queue) {
  lsSet(LS_KEYS.pendingQueue, queue);
}

function addToPendingQueue(payload) {
  const queue = getPendingQueue();
  queue.push({ ...payload, queuedAt: new Date().toISOString() });
  setPendingQueue(queue);
}

function removeFromPendingQueue(queuedAt) {
  const queue = getPendingQueue().filter((p) => p.queuedAt !== queuedAt);
  setPendingQueue(queue);
}

// ============ Local Records (본인 기록) ============
function getLocalRecords() {
  return lsGet(LS_KEYS.records, { hackathon: {}, sharing: {} });
}

function saveLocalRecord(type, name, record) {
  const all = getLocalRecords();
  if (!all[type]) all[type] = {};
  all[type][name] = record;
  lsSet(LS_KEYS.records, all);
}

// ============ Signed Names Cache ============
function getCachedSignedNames(type) {
  const cache = lsGet(LS_KEYS.signedNames, {});
  return cache[type] || [];
}

function setCachedSignedNames(type, names) {
  const cache = lsGet(LS_KEYS.signedNames, {});
  cache[type] = names;
  lsSet(LS_KEYS.signedNames, cache);
}

// 로컬에서 서명한 사람도 명단에 합쳐서 반환
function mergeSignedNames(type) {
  const fromServer = getCachedSignedNames(type);
  const fromLocal = Object.keys(getLocalRecords()[type] || {});
  const queuedNames = getPendingQueue()
    .filter((p) => p.type === type)
    .map((p) => p.name);
  return Array.from(new Set([...fromServer, ...fromLocal, ...queuedNames]));
}

// ============ API Helpers ============
async function fetchSignedNames(type) {
  if (!APPS_SCRIPT_URL) throw new Error('NO_URL');
  const url = `${APPS_SCRIPT_URL}?action=list&type=${encodeURIComponent(type)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.ok && Array.isArray(data.records)) {
    return data.records.map((r) => r.name);
  }
  throw new Error(data.error || 'fetch failed');
}

async function postReceipt(payload) {
  if (!APPS_SCRIPT_URL) throw new Error('NO_URL');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  });
  return await res.json();
}

// 큐 자동 동기화
async function syncPendingQueue(onProgress) {
  const queue = getPendingQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      const result = await postReceipt(item);
      if (result.ok) {
        synced++;
        removeFromPendingQueue(item.queuedAt);
      } else if (result.error === 'already_signed') {
        // 이미 등록된 경우도 동기화 성공으로 처리
        synced++;
        removeFromPendingQueue(item.queuedAt);
      } else {
        failed++;
        remaining.push(item);
      }
    } catch (e) {
      failed++;
      remaining.push(item);
    }
    onProgress?.({ synced, failed, total: queue.length });
  }

  return { synced, failed };
}

// ============ Signature Pad ============
function SignaturePad({ onSave, onCancel, name, accent, submitting }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2.8;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    if (submitting) return;
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stop = () => setIsDrawing(false);

  const clear = () => {
    if (submitting) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const save = () => {
    if (!hasDrawn || submitting) return;
    onSave(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl"
        style={{ borderTop: `6px solid ${accent}` }}
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-stone-100">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-1" style={{ color: accent }}>
              Signature
            </p>
            <h3 className="text-xl font-bold text-stone-900" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {name} 님 서명
            </h3>
          </div>
          <FileSignature className="w-6 h-6" style={{ color: accent }} />
        </div>

        <div className="px-6 py-5">
          <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-stone-300 bg-stone-50">
            <canvas
              ref={canvasRef}
              className="w-full h-56 touch-none cursor-crosshair block bg-white"
              onMouseDown={start}
              onMouseMove={draw}
              onMouseUp={stop}
              onMouseLeave={stop}
              onTouchStart={start}
              onTouchMove={draw}
              onTouchEnd={stop}
            />
            {!hasDrawn && !submitting && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-stone-300 text-sm tracking-wider">여기에 서명해주세요</p>
              </div>
            )}
            {submitting && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: accent }} />
                  <p className="text-xs font-bold text-stone-600">처리 중...</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-3 text-[10px] tracking-widest text-stone-400 uppercase">
              Sign here
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              onClick={clear}
              disabled={submitting}
              className="py-3 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-30"
            >
              <RotateCcw className="w-4 h-4" />
              지우기
            </button>
            <button
              onClick={onCancel}
              disabled={submitting}
              className="py-3 rounded-lg bg-stone-100 text-stone-700 text-sm font-medium hover:bg-stone-200 active:scale-95 transition disabled:opacity-30"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={!hasDrawn || submitting}
              className="py-3 rounded-lg text-white text-sm font-bold active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              style={{ backgroundColor: accent }}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '제출'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Custom Dropdown ============
function NameDropdown({ participants, value, onChange, accent, signedNames }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const selected = participants.find((p) => p.id === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-xl border-2 transition-all active:scale-[0.99] text-left"
        style={{
          borderColor: open ? accent : '#e7e5e4',
          boxShadow: open ? `0 0 0 4px ${accent}15` : 'none',
        }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: selected ? accent : '#f5f5f4' }}
        >
          <User className="w-5 h-5" style={{ color: selected ? '#ffffff' : '#a8a29e' }} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-base font-bold text-stone-900 truncate" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {selected.name}
              </p>
              <p className="text-xs text-stone-500 truncate mt-0.5">{selected.org}</p>
            </>
          ) : (
            <>
              <p
                className="text-[10px] tracking-[0.2em] uppercase font-semibold"
                style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}
              >
                Select your name
              </p>
              <p className="text-base font-bold text-stone-400 mt-0.5" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                본인 이름을 선택하세요
              </p>
            </>
          )}
        </div>
        <ChevronDown
          className="w-5 h-5 text-stone-400 shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>

      {open && (
        <div
          className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-xl border border-stone-200 shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
          style={{ boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25)' }}
        >
          {participants.map((p, idx) => {
            const isSelected = p.id === value;
            const hasSigned = signedNames.includes(p.name);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-stone-100"
                style={{
                  backgroundColor: isSelected ? `${accent}10` : 'transparent',
                  borderTop: idx === 0 ? 'none' : '1px solid #f5f5f4',
                }}
              >
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums shrink-0"
                  style={{
                    backgroundColor: isSelected ? accent : '#f5f5f4',
                    color: isSelected ? '#ffffff' : '#78716c',
                    fontFamily: "'Bodoni Moda', serif",
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-900 truncate" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {p.name}
                  </p>
                  <p className="text-[11px] text-stone-500 truncate mt-0.5">{p.org}</p>
                </div>
                {hasSigned && (
                  <span
                    className="shrink-0 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: '#f5f5f4', color: '#78716c' }}
                  >
                    서명완료
                  </span>
                )}
                {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: accent }} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Item Selector ============
function ItemPicker({ value, onChange, items, accent }) {
  const cols = items.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <div className={`grid ${cols} gap-3`}>
      {items.map((item) => {
        const selected = value === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className="relative py-5 px-4 rounded-xl border-2 transition-all active:scale-[0.97] text-left overflow-hidden"
            style={{
              borderColor: selected ? accent : '#e7e5e4',
              backgroundColor: selected ? `${accent}10` : '#ffffff',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{
                  backgroundColor: selected ? accent : '#f5f5f4',
                  color: selected ? '#ffffff' : '#78716c',
                }}
              >
                <Icon className="w-6 h-6" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-stone-900 truncate">{item.label}</p>
                <p
                  className="text-[10px] tracking-wider uppercase mt-0.5"
                  style={{ color: selected ? accent : '#a8a29e' }}
                >
                  {item.sub}
                </p>
              </div>
            </div>
            {selected && (
              <div
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accent }}
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============ Sync Status Indicator ============
function SyncIndicator({ pendingCount, online, syncing, onSync }) {
  if (pendingCount === 0 && online) return null;

  const isOffline = !online;
  const hasPending = pendingCount > 0;

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-2.5"
      style={{
        backgroundColor: isOffline ? '#fef3c7' : '#fef3c7',
        border: `1px solid ${isOffline ? '#fde68a' : '#fde68a'}`,
      }}
    >
      {isOffline ? (
        <CloudOff className="w-4 h-4 shrink-0" style={{ color: '#92400e' }} />
      ) : (
        <Cloud className="w-4 h-4 shrink-0" style={{ color: '#92400e' }} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: '#92400e' }}>
          {isOffline
            ? '오프라인 상태입니다'
            : `전송 대기 중인 서명 ${pendingCount}건`}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#92400e', opacity: 0.85 }}>
          {isOffline
            ? '서명은 정상 저장됩니다. 연결되면 자동으로 전송됩니다.'
            : '아래 버튼으로 즉시 재전송할 수 있습니다.'}
        </p>
      </div>
      {hasPending && online && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded inline-flex items-center gap-1 disabled:opacity-50"
          style={{ backgroundColor: '#92400e', color: '#fef3c7' }}
        >
          {syncing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {syncing ? '전송 중' : '재전송'}
        </button>
      )}
    </div>
  );
}

// ============ Receipt Selector ============
function ReceiptSelector({ onSelect, pendingCount, online, syncing, onSync }) {
  const tiles = Object.values(RECEIPTS);
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fafaf9' }}>
      <div
        className="h-1.5 w-full flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, #ff003c 0%, #ff003c 50%, #519c90 50%, #519c90 100%)' }}
      />

      <div className="bg-white flex-shrink-0 border-b border-stone-200">
        <div className="px-5 pt-7 pb-8 max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5" style={{ backgroundColor: '#ff003c' }} />
              <p
                className="text-[10px] tracking-[0.25em] uppercase font-bold text-stone-500"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                서울특별시사회복지사협회
              </p>
            </div>
            <Award className="w-5 h-5 text-stone-300" />
          </div>

          <h1
            className="text-3xl font-black text-stone-900 leading-[1.15] tracking-tight"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            수령증 선택
          </h1>
          <p
            className="text-xs tracking-[0.25em] uppercase font-bold mt-2"
            style={{ color: '#519c90', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Receipt System
          </p>
          <p className="text-sm text-stone-500 mt-3" style={{ fontFamily: "'Noto Serif KR', serif" }}>
            해당하는 수령증을 선택해 주세요
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-xl w-full mx-auto px-5 py-8 space-y-4">
        <SyncIndicator pendingCount={pendingCount} online={online} syncing={syncing} onSync={onSync} />

        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              onClick={() => onSelect(tile.id)}
              className="group w-full text-left bg-white rounded-2xl overflow-hidden transition-all active:scale-[0.99] hover:-translate-y-0.5"
              style={{
                boxShadow: '0 1px 0 0 rgba(0,0,0,0.04) inset, 0 8px 28px -12px rgba(0,0,0,0.18)',
                border: '1px solid #f5f5f4',
              }}
            >
              <div
                className="h-2 w-full"
                style={{ background: `linear-gradient(90deg, ${tile.accent} 0%, ${tile.accent}80 100%)` }}
              />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${tile.accent}15` }}
                  >
                    <Icon className="w-7 h-7" style={{ color: tile.accent }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[10px] tracking-[0.25em] uppercase font-semibold mb-1"
                      style={{ color: tile.accent, fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {tile.subtitle}
                    </p>
                    <h3
                      className="text-lg font-bold text-stone-900 leading-snug"
                      style={{ fontFamily: "'Noto Serif KR', serif" }}
                    >
                      {tile.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-2 whitespace-pre-line leading-relaxed">{tile.program}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-300 shrink-0 mt-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          );
        })}

        <div
          className="mt-6 rounded-xl p-4 flex items-start gap-3"
          style={{ backgroundColor: '#f5f5f4', border: '1px solid #e7e5e4' }}
        >
          <Lock className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-stone-700" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              개별 작성 안내
            </p>
            <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
              본인 이름을 선택한 후 수령한 항목을 확인하고 서명합니다. 데이터는 협회 스프레드시트에 저장되며, 오프라인 상태에서도 서명할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <footer className="px-5 pb-8 max-w-xl mx-auto w-full flex flex-col items-center gap-4">
        <p
          className="text-center text-[10px] text-stone-400 tracking-wider"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          DIGITAL CAPACITY BUILDING PROGRAM · 2026
        </p>
        <button
          onClick={() => {
            if (window.confirm('기기에 저장된 모든 수령 내역과 대기열을 초기화하시겠습니까?\n(서버의 데이터는 유지됩니다)')) {
              localStorage.removeItem(LS_KEYS.records);
              localStorage.removeItem(LS_KEYS.signedNames);
              localStorage.removeItem(LS_KEYS.pendingQueue);
              window.location.reload();
            }
          }}
          className="text-[11px] text-stone-400 underline decoration-stone-300 underline-offset-4 hover:text-stone-600 transition-colors opacity-50 hover:opacity-100"
        >
          앱 데이터 초기화
        </button>
      </footer>
    </div>
  );
}

// ============ Receipt Detail Page ============
function ReceiptDetail({ config, onBack, online, onSync, syncing, pendingCount, onRecordSubmit }) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(null);
  const [signedNames, setSignedNames] = useState(() => mergeSignedNames(config.id));
  const [submitError, setSubmitError] = useState(null);

  const selectedPerson = config.participants.find((p) => p.id === selectedId);
  const alreadySigned = selectedPerson && signedNames.includes(selectedPerson.name);

  const refreshSignedNames = useCallback(async () => {
    // 로컬 캐시는 바로 반영
    setSignedNames(mergeSignedNames(config.id));

    // 온라인이면 서버와 동기화
    if (online && APPS_SCRIPT_URL) {
      try {
        const fromServer = await fetchSignedNames(config.id);
        setCachedSignedNames(config.id, fromServer);
        setSignedNames(mergeSignedNames(config.id));
      } catch (e) {
        // 실패해도 로컬 캐시는 유지
      }
    }
  }, [config.id, online]);

  useEffect(() => {
    refreshSignedNames();
  }, [refreshSignedNames]);

  // pendingCount나 online 상태가 바뀌면 명단 다시 머지
  useEffect(() => {
    setSignedNames(mergeSignedNames(config.id));
  }, [config.id, pendingCount, online]);

  useEffect(() => {
    if (selectedId && config.items.length === 1 && !selectedItem) {
      setSelectedItem(config.items[0].id);
    }
    if (!selectedId) setSelectedItem(null);
  }, [selectedId, config.items, selectedItem]);

  const handleSubmit = async (signatureData) => {
    if (!selectedPerson || !selectedItem) return;
    const itemDef = config.items.find((i) => i.id === selectedItem);
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      type: config.id,
      name: selectedPerson.name,
      org: selectedPerson.org,
      division: config.division,
      item: itemDef.label,
      signature: signatureData,
    };

    const localTimestamp = new Date().toISOString();
    const localRecord = {
      ...payload,
      itemLabel: itemDef.label,
      signedAt: localTimestamp,
      synced: false,
    };

    // 1) 즉시 localStorage에 저장
    saveLocalRecord(config.id, selectedPerson.name, localRecord);
    onRecordSubmit?.();

    // 2) 온라인이면 즉시 전송 시도
    let synced = false;
    let syncError = null;

    if (online && APPS_SCRIPT_URL) {
      try {
        const result = await postReceipt(payload);
        if (result.ok) {
          synced = true;
          // 로컬에 동기화 표시
          saveLocalRecord(config.id, selectedPerson.name, { ...localRecord, synced: true });
        } else if (result.error === 'already_signed') {
          // 서버에 이미 있으면 동기화 성공으로 처리
          synced = true;
          saveLocalRecord(config.id, selectedPerson.name, { ...localRecord, synced: true });
        } else {
          syncError = result.error || '제출 실패';
        }
      } catch (e) {
        syncError = 'network';
      }
    } else {
      syncError = 'offline';
    }

    // 3) 동기화 실패 시 큐에 추가
    if (!synced) {
      addToPendingQueue(payload);
      onRecordSubmit?.();
    }

    setSubmitting(false);
    setSigning(false);
    setShowThanks({
      name: selectedPerson.name,
      org: selectedPerson.org,
      itemLabel: itemDef.label,
      signature: signatureData,
      signedAt: localTimestamp,
      synced,
      syncError,
    });

    // 명단 갱신
    setSignedNames(mergeSignedNames(config.id));
  };

  const closeThanks = () => {
    setShowThanks(null);
    setSelectedId(null);
    setSelectedItem(null);
  };

  const itemDef = selectedItem ? config.items.find((i) => i.id === selectedItem) : null;

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: '#fafaf9' }}>
      <div className="h-1.5 w-full" style={{ backgroundColor: config.accent }} />

      <header className="bg-white border-b border-stone-200">
        <div className="px-5 pt-4 pb-7 max-w-xl mx-auto">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-stone-400 hover:text-stone-700 text-xs mb-5 tracking-wider uppercase transition"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            수령증 선택
          </button>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5" style={{ backgroundColor: config.accent }} />
              <p
                className="text-[10px] tracking-[0.25em] uppercase font-bold text-stone-500"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                서울특별시사회복지사협회
              </p>
            </div>
            <Award className="w-5 h-5" style={{ color: config.accent, opacity: 0.4 }} />
          </div>

          <p
            className="text-[10px] tracking-[0.25em] uppercase font-bold mb-2"
            style={{ color: config.accent, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {config.subtitle}
          </p>
          <h1
            className="text-2xl sm:text-[28px] font-black text-stone-900 leading-[1.2] tracking-tight"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            {config.title}
          </h1>

          <div
            className="mt-5 rounded-xl overflow-hidden"
            style={{ backgroundColor: '#fafaf9', border: '1px solid #e7e5e4' }}
          >
            <div className="px-4 py-3 border-b border-stone-200">
              <p
                className="text-[9px] uppercase tracking-widest text-stone-400 mb-1"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                사업명
              </p>
              <p
                className="text-stone-800 text-sm font-medium leading-snug"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                {config.programShort}
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-stone-200">
              <div className="px-4 py-3">
                <p
                  className="text-[9px] uppercase tracking-widest text-stone-400 mb-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  일자
                </p>
                <p className="text-stone-800 text-xs font-semibold">{config.date}</p>
              </div>
              <div className="px-4 py-3">
                <p
                  className="text-[9px] uppercase tracking-widest text-stone-400 mb-1"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  구분
                </p>
                <p className="text-xs font-semibold" style={{ color: config.accent }}>
                  {config.division}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 pt-6 space-y-6">
        <SyncIndicator pendingCount={pendingCount} online={online} syncing={syncing} onSync={onSync} />

        <section>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ backgroundColor: config.accent }}
            >
              1
            </span>
            <h2 className="text-sm font-bold text-stone-900 tracking-tight" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              본인 이름 선택
            </h2>
          </div>
          <NameDropdown
            participants={config.participants}
            value={selectedId}
            onChange={setSelectedId}
            accent={config.accent}
            signedNames={signedNames}
          />
          {alreadySigned && selectedPerson && (
            <div
              className="mt-3 rounded-lg p-3 flex items-start gap-2.5"
              style={{ backgroundColor: '#fef3f2', border: '1px solid #fecaca' }}
            >
              <Lock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
              <div className="flex-1">
                <p className="text-xs font-bold" style={{ color: '#991b1b' }}>
                  이미 서명이 제출된 분입니다
                </p>
                <p className="text-[11px] mt-1" style={{ color: '#991b1b', opacity: 0.8 }}>
                  중복 서명은 불가능합니다. 수정이 필요한 경우 협회 담당자에게 문의해주세요.
                </p>
              </div>
            </div>
          )}
        </section>

        {selectedId && !alreadySigned && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ backgroundColor: config.accent }}
              >
                2
              </span>
              <h2 className="text-sm font-bold text-stone-900 tracking-tight" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                수령 {config.goodsLabel} 확인
              </h2>
            </div>
            {config.items.length > 1 ? (
              <>
                <p className="text-xs text-stone-500 mb-3 leading-relaxed">
                  실제로 수령하신 {config.goodsLabel}을 선택해 주세요.
                </p>
                <ItemPicker
                  value={selectedItem}
                  onChange={setSelectedItem}
                  items={config.items}
                  accent={config.accent}
                />
              </>
            ) : (
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={{ backgroundColor: `${config.accent}10`, border: `2px solid ${config.accent}` }}
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: config.accent }}
                >
                  {React.createElement(config.items[0].icon, {
                    className: 'w-6 h-6 text-white',
                    strokeWidth: 2.2,
                  })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-900">{config.items[0].label}</p>
                  <p className="text-[10px] tracking-wider uppercase mt-0.5" style={{ color: config.accent }}>
                    수령 확인
                  </p>
                </div>
                <Check className="w-5 h-5 shrink-0" style={{ color: config.accent }} strokeWidth={3} />
              </div>
            )}
          </section>
        )}

        {selectedId && selectedItem && !alreadySigned && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ backgroundColor: config.accent }}
              >
                3
              </span>
              <h2 className="text-sm font-bold text-stone-900 tracking-tight" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                수령 확인 및 서명
              </h2>
            </div>
            <div
              className="rounded-2xl bg-white p-5 border-l-4"
              style={{
                borderLeftColor: config.accent,
                boxShadow: '0 4px 16px -8px rgba(0,0,0,0.1)',
              }}
            >
              <p className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: config.accent }}>
                Receipt Statement
              </p>

              <div className="space-y-2 mb-4 pb-4 border-b border-dashed border-stone-200">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">성명</span>
                  <span className="font-bold text-stone-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                    {selectedPerson.name}
                  </span>
                </div>
                <div className="flex justify-between text-xs gap-3">
                  <span className="text-stone-400 shrink-0">기관명</span>
                  <span className="font-medium text-stone-700 text-right">{selectedPerson.org}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">{config.goodsLabel}</span>
                  <span className="font-bold" style={{ color: config.accent }}>
                    {itemDef?.label}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-400">일시</span>
                  <span className="font-medium text-stone-700">{config.date}</span>
                </div>
              </div>

              <p
                className="text-center text-sm font-medium text-stone-800"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                위 {config.goodsLabel}을 정히 수령함
              </p>
              <p className="text-center text-xs text-stone-400 mt-1">서울특별시사회복지사협회 귀중</p>
            </div>

            {submitError && (
              <div
                className="mt-3 rounded-lg p-3 text-xs font-medium"
                style={{ backgroundColor: '#fef3f2', border: '1px solid #fecaca', color: '#991b1b' }}
              >
                {submitError}
              </div>
            )}

            <button
              onClick={() => setSigning(true)}
              className="mt-4 w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition active:scale-[0.98]"
              style={{ backgroundColor: '#1c1917' }}
            >
              <FileSignature className="w-5 h-5" />
              서명하고 제출하기
              <ChevronRight className="w-5 h-5" />
            </button>
          </section>
        )}

        {!selectedId && (
          <div
            className="rounded-2xl py-10 px-5 text-center"
            style={{ backgroundColor: '#ffffff', border: '1px dashed #d6d3d1' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: '#f5f5f4' }}
            >
              <User className="w-6 h-6 text-stone-400" />
            </div>
            <p className="text-sm font-bold text-stone-700" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              먼저 본인 이름을 선택해주세요
            </p>
            <p className="text-xs text-stone-400 mt-1">위 드롭다운에서 본인 이름을 선택하면 진행됩니다</p>
          </div>
        )}
      </main>

      <p
        className="fixed bottom-3 left-0 right-0 text-center text-[10px] text-stone-400 tracking-wider px-5"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        SEOUL ASSOCIATION OF SOCIAL WORKERS · {config.dateShort}
      </p>

      {signing && (
        <SignaturePad
          name={selectedPerson.name}
          accent={config.accent}
          submitting={submitting}
          onSave={handleSubmit}
          onCancel={() => !submitting && setSigning(false)}
        />
      )}

      {showThanks && <ThanksScreen data={showThanks} config={config} onClose={closeThanks} />}
    </div>
  );
}

// ============ Thanks ============
function ThanksScreen({ data, config, onClose }) {
  const signedDate = new Date(data.signedAt);
  const timeStr = signedDate.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div
          className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${config.accent} 0%, ${config.accent}dd 100%)` }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 12px)',
            }}
          />
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-9 h-9 text-white" strokeWidth={2.2} />
            </div>
            <p
              className="text-[10px] tracking-[0.3em] uppercase font-semibold text-white/80 mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Receipt Confirmed
            </p>
            <h2 className="text-2xl font-black text-white" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              수령이 완료되었습니다
            </h2>
            <p className="text-sm text-white/80 mt-1" style={{ fontFamily: "'Noto Serif KR', serif" }}>
              {data.name} 님, 감사합니다
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* Sync status badge */}
          {data.synced ? (
            <div
              className="mb-4 rounded-lg p-2.5 flex items-center gap-2"
              style={{ backgroundColor: '#f0f9f7', border: '1px solid #519c9050' }}
            >
              <Cloud className="w-4 h-4 shrink-0" style={{ color: '#519c90' }} />
              <p className="text-[11px] font-semibold flex-1" style={{ color: '#519c90' }}>
                스프레드시트에 정상 저장되었습니다
              </p>
            </div>
          ) : (
            <div
              className="mb-4 rounded-lg p-2.5 flex items-start gap-2"
              style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#92400e' }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold" style={{ color: '#92400e' }}>
                  서명은 정상 저장되었습니다 (전송 대기)
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#92400e', opacity: 0.85 }}>
                  네트워크 연결 시 자동으로 스프레드시트로 전송됩니다.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2.5 pb-4 border-b border-dashed border-stone-200">
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">성명</span>
              <span className="font-bold text-stone-800" style={{ fontFamily: "'Noto Serif KR', serif" }}>
                {data.name}
              </span>
            </div>
            <div className="flex justify-between text-xs gap-3">
              <span className="text-stone-400 shrink-0">기관명</span>
              <span className="font-medium text-stone-700 text-right">{data.org}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">{config.goodsLabel}</span>
              <span className="font-bold" style={{ color: config.accent }}>
                {data.itemLabel}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-stone-400">제출시각</span>
              <span
                className="font-medium text-stone-700 text-right"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {timeStr}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg p-3 bg-stone-50 border border-stone-100">
            <p
              className="text-[9px] uppercase tracking-widest text-stone-400 mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              서명
            </p>
            <div className="bg-white rounded p-2 border border-stone-100 flex items-center justify-center">
              <img src={data.signature} alt="서명" className="h-16 w-auto max-w-full object-contain" />
            </div>
          </div>

          <p
            className="text-center text-[11px] text-stone-400 mt-4"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            서울특별시사회복지사협회 귀중
          </p>

          <button
            onClick={onClose}
            className="w-full mt-5 py-3.5 rounded-xl text-white font-bold transition active:scale-[0.98]"
            style={{ backgroundColor: '#1c1917' }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Setup Warning ============
function SetupWarning() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#fafaf9' }}>
      <div className="max-w-md w-full bg-white rounded-2xl p-6 border-l-4" style={{ borderLeftColor: '#ff003c' }}>
        <h1 className="text-lg font-black text-stone-900 mb-2" style={{ fontFamily: "'Noto Serif KR', serif" }}>
          ⚙️ 설정이 필요합니다
        </h1>
        <p className="text-sm text-stone-600 mb-4">
          Google Apps Script 웹 앱 URL이 설정되지 않았습니다.
        </p>
        <div className="bg-stone-50 rounded-lg p-3 text-xs font-mono text-stone-700 space-y-1">
          <p>1. apps-script/Code.gs 를 Apps Script에 배포</p>
          <p>2. 발급된 웹 앱 URL을 .env 의</p>
          <p style={{ color: '#ff003c' }}>VITE_APPS_SCRIPT_URL=&lt;URL&gt;</p>
          <p>에 입력</p>
          <p>3. 다시 빌드 또는 npm run dev</p>
        </div>
        <p className="text-xs text-stone-400 mt-4">자세한 내용은 README.md 참고</p>
      </div>
    </div>
  );
}

// ============ Main App ============
export default function App() {
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingQueue().length);
  const [syncing, setSyncing] = useState(false);

  // 온라인/오프라인 상태 감지
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getPendingQueue().length);
  }, []);

  const runSync = useCallback(async () => {
    if (syncing) return;
    if (!online || !APPS_SCRIPT_URL) return;
    if (getPendingQueue().length === 0) return;
    setSyncing(true);
    try {
      await syncPendingQueue(refreshPendingCount);
    } finally {
      refreshPendingCount();
      setSyncing(false);
    }
  }, [online, syncing, refreshPendingCount]);

  // 온라인 복귀 시 자동 동기화
  useEffect(() => {
    if (online) {
      const timer = setTimeout(runSync, 800);
      return () => clearTimeout(timer);
    }
  }, [online, runSync]);

  // 30초마다 체크 (앱이 켜져 있는 동안)
  useEffect(() => {
    const interval = setInterval(() => {
      if (online && getPendingQueue().length > 0) runSync();
    }, 30000);
    return () => clearInterval(interval);
  }, [online, runSync]);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&family=Bodoni+Moda:wght@400;700;900&family=JetBrains+Mono:wght@400;600&display=swap"
        rel="stylesheet"
      />
      {!APPS_SCRIPT_URL ? (
        <SetupWarning />
      ) : activeReceipt ? (
        <ReceiptDetail
          config={RECEIPTS[activeReceipt]}
          onBack={() => setActiveReceipt(null)}
          online={online}
          onSync={runSync}
          syncing={syncing}
          pendingCount={pendingCount}
          onRecordSubmit={refreshPendingCount}
        />
      ) : (
        <ReceiptSelector
          onSelect={setActiveReceipt}
          pendingCount={pendingCount}
          online={online}
          syncing={syncing}
          onSync={runSync}
        />
      )}
    </>
  );
}
