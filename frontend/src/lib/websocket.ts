/**
 * FinSight AI — WebSocket Connection Manager (Client)
 *
 * Manages WebSocket connections with automatic reconnection,
 * heartbeat monitoring, and typed event handling.
 */

export type WSEventHandler = (data: any) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Map<string, WSEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private isConnecting = false;
  private statusCallback: ((status: 'connected' | 'disconnected' | 'reconnecting') => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  onStatusChange(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void) {
    this.statusCallback = callback;
  }

  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.statusCallback?.('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const eventType = message.event || 'message';
          const handlers = this.handlers.get(eventType) || [];
          handlers.forEach(handler => handler(message.data || message));

          // Also fire 'all' handlers
          const allHandlers = this.handlers.get('*') || [];
          allHandlers.forEach(handler => handler(message));
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.statusCallback?.('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        this.ws?.close();
      };
    } catch {
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    this.statusCallback?.('reconnecting');

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * Math.min(this.reconnectAttempts, 5));
  }

  on(event: string, handler: WSEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler?: WSEventHandler): void {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      const handlers = this.handlers.get(event) || [];
      this.handlers.set(event, handlers.filter(h => h !== handler));
    }
  }

  send(data: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/** API base URL for REST endpoints */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Create WebSocket URL from a path */
export function wsUrl(path: string): string {
  const base = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://');
  return `${base}${path}`;
}
