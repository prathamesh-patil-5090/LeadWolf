import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BRIGHT_DATA_API_BASE,
  BRIGHT_DATA_DEFAULT_POLL_INTERVAL_MS,
  BRIGHT_DATA_DEFAULT_POLL_TIMEOUT_MS,
  BRIGHT_DATA_LINKEDIN_PROFILE_DATASET_ID,
  BRIGHT_DATA_MAX_SYNC_PROFILE_URLS,
} from './bright-data.constants';
import {
  BrightDataLinkedInRecord,
  mapBrightDataRecordToDiscoveredLead,
} from './linkedin-profile.mapper';

interface BrightDataTriggerResponse {
  snapshot_id?: string;
}

interface BrightDataProgressResponse {
  status?: string;
  snapshot_id?: string;
}

@Injectable()
export class BrightDataService {
  private readonly logger = new Logger(BrightDataService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured() {
    return Boolean(this.configService.get<string>('BRIGHT_DATA_API_KEY')?.trim());
  }

  async collectLinkedInProfiles(urls: string[]) {
    const normalized = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
    if (normalized.length === 0) {
      return [];
    }

    const records: BrightDataLinkedInRecord[] = [];

    for (let index = 0; index < normalized.length; index += BRIGHT_DATA_MAX_SYNC_PROFILE_URLS) {
      const batch = normalized.slice(index, index + BRIGHT_DATA_MAX_SYNC_PROFILE_URLS);
      const batchRecords = await this.scrapeProfiles(batch);
      records.push(...batchRecords);
    }

    return records
      .map((record) => mapBrightDataRecordToDiscoveredLead(record))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));
  }

  async collectLinkedInProfile(url: string) {
    const [lead] = await this.collectLinkedInProfiles([url]);
    return lead ?? null;
  }

  private async scrapeProfiles(urls: string[]) {
    const input = urls.map((url) => ({ url }));
    const response = await this.postDataset('/datasets/v3/scrape', {
      datasetId: this.profileDatasetId(),
      input,
    });

    const parsed = this.parseResponseBody(response.body);

    if (parsed.snapshotId) {
      this.logger.log(
        `Bright Data scrape switched to async snapshot ${parsed.snapshotId}`,
      );
      return this.waitForSnapshot<BrightDataLinkedInRecord>(parsed.snapshotId);
    }

    return parsed.records as BrightDataLinkedInRecord[];
  }

  private async waitForSnapshot<T>(snapshotId: string) {
    const pollInterval = this.readInt(
      'BRIGHT_DATA_POLL_INTERVAL_MS',
      BRIGHT_DATA_DEFAULT_POLL_INTERVAL_MS,
    );
    const timeoutMs = this.readInt(
      'BRIGHT_DATA_POLL_TIMEOUT_MS',
      BRIGHT_DATA_DEFAULT_POLL_TIMEOUT_MS,
    );
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const progress = await this.request(
        'GET',
        `/datasets/v3/progress/${encodeURIComponent(snapshotId)}`,
      );

      const progressBody = JSON.parse(progress.body) as BrightDataProgressResponse;
      const status = progressBody.status?.toLowerCase();

      if (status === 'ready' || status === 'done' || status === 'completed') {
        break;
      }

      if (status === 'failed' || status === 'error') {
        throw new Error(
          `Bright Data snapshot ${snapshotId} failed: ${progress.body.slice(0, 300)}`,
        );
      }

      await this.sleep(pollInterval);
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `Bright Data snapshot ${snapshotId} timed out after ${timeoutMs}ms`,
      );
    }

    const snapshot = await this.request(
      'GET',
      `/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
    );

    const parsed = this.parseResponseBody(snapshot.body);
    return parsed.records as T[];
  }

  private async postDataset(
    path: '/datasets/v3/scrape' | '/datasets/v3/trigger',
    params: {
      datasetId: string;
      input: unknown[];
    },
  ) {
    const query = new URLSearchParams({
      dataset_id: params.datasetId,
      format: 'json',
      include_errors: 'true',
    });

    return this.request('POST', `${path}?${query.toString()}`, {
      input: params.input,
    });
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ) {
    const apiKey = this.configService.getOrThrow<string>('BRIGHT_DATA_API_KEY');
    const url = `${BRIGHT_DATA_API_BASE}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `Bright Data ${method} ${path} failed (${response.status}): ${responseBody.slice(0, 400)}`,
      );
    }

    return { body: responseBody };
  }

  private parseResponseBody(body: string) {
    let payload: unknown = body;

    try {
      payload = JSON.parse(body);
    } catch {
      return { records: [], payload: body };
    }

    if (Array.isArray(payload)) {
      return { records: payload, payload };
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'snapshot_id' in payload &&
      typeof (payload as BrightDataTriggerResponse).snapshot_id === 'string'
    ) {
      return {
        snapshotId: (payload as BrightDataTriggerResponse).snapshot_id,
        records: [],
        payload,
      };
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      Array.isArray((payload as { data: unknown[] }).data)
    ) {
      return {
        records: (payload as { data: unknown[] }).data,
        payload,
      };
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'results' in payload &&
      Array.isArray((payload as { results: unknown[] }).results)
    ) {
      return {
        records: (payload as { results: unknown[] }).results,
        payload,
      };
    }

    return { records: [], payload };
  }

  private profileDatasetId() {
    return (
      this.configService.get<string>('BRIGHT_DATA_LINKEDIN_PROFILE_DATASET_ID') ??
      BRIGHT_DATA_LINKEDIN_PROFILE_DATASET_ID
    );
  }

  private readInt(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
