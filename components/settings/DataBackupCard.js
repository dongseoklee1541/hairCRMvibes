'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import styles from './DataBackupCard.module.css';

const EXPORT_OPTIONS = [
  { dataset: 'customers', label: '고객 CSV' },
  { dataset: 'appointments', label: '예약 CSV' },
];

const ERROR_MESSAGES = {
  AUTH_REQUIRED: '로그인 세션을 확인한 뒤 다시 시도해주세요.',
  AUTH_INVALID: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
  OWNER_REQUIRED: '원장 계정만 데이터를 백업할 수 있습니다.',
  EXPORT_CONFIG_MISSING: '백업 기능 설정을 확인할 수 없습니다.',
  EXPORT_AUTHORIZATION_UNAVAILABLE: '권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
  EXPORT_QUERY_FAILED: '백업 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  EXPORT_FAILED: 'CSV 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

function createInitialExportStates() {
  return {
    customers: { status: 'idle', message: '' },
    appointments: { status: 'idle', message: '' },
  };
}

function getDownloadFilename(response, dataset) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename="?([A-Za-z0-9._-]+)"?/i.exec(disposition);
  return match?.[1] || `haircrm_${dataset}.csv`;
}

function getSuggestedFilename(dataset) {
  const dateKey = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(new Date());
  return `haircrm_${dataset}_${dateKey}.csv`;
}

async function chooseStreamingFile(dataset) {
  if (typeof window.showSaveFilePicker !== 'function') {
    return null;
  }

  return window.showSaveFilePicker({
    suggestedName: getSuggestedFilename(dataset),
    types: [
      {
        description: 'CSV 파일',
        accept: { 'text/csv': ['.csv'] },
      },
    ],
    excludeAcceptAllOption: true,
  });
}

async function downloadCsvResponse(response, dataset, fileHandle) {
  if (fileHandle && response.body && typeof fileHandle.createWritable === 'function') {
    const writable = await fileHandle.createWritable();
    await response.body.pipeTo(writable);
    return 'streamed';
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = objectUrl;
    link.download = getDownloadFilename(response, dataset);
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
  }

  return 'downloaded';
}

async function readErrorCode(response) {
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : 'EXPORT_FAILED';
  } catch {
    return 'EXPORT_FAILED';
  }
}

export default function DataBackupCard() {
  const { session } = useAuth();
  const [acknowledged, setAcknowledged] = useState(false);
  const [exportStates, setExportStates] = useState(createInitialExportStates);

  const setDatasetState = (dataset, state) => {
    setExportStates((current) => ({
      ...current,
      [dataset]: state,
    }));
  };

  const handleExport = async (dataset, label) => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setDatasetState(dataset, {
        status: 'error',
        message: ERROR_MESSAGES.AUTH_REQUIRED,
      });
      return;
    }

    try {
      let fileHandle = null;

      try {
        fileHandle = await chooseStreamingFile(dataset);
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }
        throw error;
      }

      setDatasetState(dataset, { status: 'loading', message: '' });

      const response = await fetch(`/api/export?dataset=${dataset}`, {
        method: 'GET',
        headers: {
          Accept: 'text/csv',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorCode = await readErrorCode(response);
        throw new Error(errorCode);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().startsWith('text/csv')) {
        throw new Error('EXPORT_FAILED');
      }

      const downloadMode = await downloadCsvResponse(response, dataset, fileHandle);

      setDatasetState(dataset, {
        status: 'success',
        message:
          downloadMode === 'streamed'
            ? `${label} 저장을 완료했습니다.`
            : `${label} 다운로드를 시작했습니다.`,
      });
    } catch (error) {
      const errorCode = typeof error?.message === 'string' ? error.message : 'EXPORT_FAILED';
      setDatasetState(dataset, {
        status: 'error',
        message: ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.EXPORT_FAILED,
      });
    }
  };

  const isExporting = EXPORT_OPTIONS.some(
    ({ dataset }) => exportStates[dataset].status === 'loading'
  );

  return (
    <section className={`card ${styles.card}`} aria-labelledby="data-backup-title">
      <div className={styles.headingGroup}>
        <h2 id="data-backup-title" className="heading-md">
          데이터 백업
        </h2>
        <p className={styles.description}>
          전체 고객 연락처와 예약 메모를 각각 CSV 파일로 내려받습니다.
        </p>
      </div>

      <div id="data-backup-warning" className={styles.warningBox}>
        <AlertTriangle size={18} aria-hidden="true" />
        <span>
          민감한 고객 정보가 포함됩니다. 다운로드 즉시 기기 암호화 저장소로 옮기고 30일
          이내 삭제해주세요.
        </span>
      </div>

      <label className={styles.acknowledgement}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={isExporting}
          aria-describedby="data-backup-warning data-backup-hint"
        />
        <span>암호화 보관·30일 이내 삭제 정책을 확인했습니다.</span>
      </label>

      <p id="data-backup-hint" className={styles.hint}>
        다운로드 폴더·휴지통·클라우드 사본도 함께 삭제해주세요.
      </p>

      <div className={styles.actionGrid}>
        {EXPORT_OPTIONS.map(({ dataset, label }) => {
          const state = exportStates[dataset];
          const loading = state.status === 'loading';

          return (
            <button
              key={dataset}
              type="button"
              className={styles.exportButton}
              onClick={() => handleExport(dataset, label)}
              disabled={!acknowledged || isExporting}
              aria-busy={loading}
              aria-describedby={state.message ? `data-backup-${dataset}-status` : undefined}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={18} aria-hidden="true" />
              )}
              <span>{loading ? '준비 중...' : label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.statusRegion}>
        {EXPORT_OPTIONS.map(({ dataset }) => {
          const state = exportStates[dataset];
          if (!state.message) {
            return null;
          }

          return (
            <p
              key={dataset}
              id={`data-backup-${dataset}-status`}
              className={state.status === 'error' ? styles.errorStatus : styles.successStatus}
              role={state.status === 'error' ? 'alert' : 'status'}
            >
              {state.status === 'success' ? <CheckCircle2 size={16} aria-hidden="true" /> : null}
              {state.message}
            </p>
          );
        })}
      </div>
    </section>
  );
}
