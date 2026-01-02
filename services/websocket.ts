import { APP_CONFIG } from '../config';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private userId: string | null = null;
  private isConnecting = false;

  connect(userId: string | null) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    
    this.userId = userId;
    this.isConnecting = true;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Authenticate if user is logged in
        if (userId) {
          this.send({ type: 'auth', userId });
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.isConnecting = false;
      };
      
      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.isConnecting = false;
        this.ws = null;
        
        // Auto-reconnect if user is logged in
        if (userId && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(userId);
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
    } catch (err) {
      console.error('[WS] Connection error:', err);
      this.isConnecting = false;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.userId = null;
    this.reconnectAttempts = 0;
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  private handleMessage(data: any) {
    // Handle specific message types
    if (data.type === 'notification') {
      this.emit('notification', data.notification);
    } else if (data.type === 'post_created' || data.type === 'post_updated' || data.type === 'post_deleted') {
      this.emit('post_update', data);
    } else if (data.type === 'thread_created' || data.type === 'thread_updated' || data.type === 'thread_deleted') {
      this.emit('thread_update', data);
    } else if (data.type === 'forum_updated' || data.type === 'forum_deleted') {
      this.emit('forum_update', data);
    } else {
      // Emit generic event
      this.emit(data.type, data);
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('[WS] Callback error:', err);
        }
      });
    }
    
    // Also emit to 'all' listeners
    const allCallbacks = this.listeners.get('all');
    if (allCallbacks) {
      allCallbacks.forEach(callback => {
        try {
          callback({ event, data });
        } catch (err) {
          console.error('[WS] Callback error:', err);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();

