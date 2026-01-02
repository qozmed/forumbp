class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private userId: string | null = null;
  private isConnecting = false;
  private pingInterval: any = null;

  connect(userId: string | null) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    
    this.userId = userId;
    this.isConnecting = true;
    
    // Dynamically determine protocol based on current page
    // If on HTTPS, must use WSS. If HTTP, use WS.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Connect to /ws on the same host (handled by Vite proxy in dev, or Nginx/Express in prod)
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log(`[WS] Connecting to ${wsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Start Ping
        this.startPing();

        // Authenticate if user is logged in
        if (this.userId) {
          this.send({ type: 'auth', userId: this.userId });
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return; // Ignore pongs
          this.handleMessage(data);
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.isConnecting = false;
      };
      
      this.ws.onclose = (e) => {
        console.log(`[WS] Disconnected (Code: ${e.code})`);
        this.isConnecting = false;
        this.stopPing();
        this.ws = null;
        
        // Auto-reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
          console.log(`[WS] Reconnecting in ${Math.round(delay)}ms...`);
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.userId);
          }, delay);
        }
      };
    } catch (err) {
      console.error('[WS] Connection creation error:', err);
      this.isConnecting = false;
    }
  }

  disconnect() {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.userId = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, 25000); // 25s keepalive
  }

  private stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
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
    } else if (data.type === 'user_activity') {
      this.emit('user_activity', data);
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
