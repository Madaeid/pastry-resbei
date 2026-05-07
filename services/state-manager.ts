export type StateListener<T> = (state: T) => void;

/**
 * A lightweight, reactive state management library for Multi-Page Applications.
 * It persists state to localStorage and synchronizes data across different pages/tabs
 * in real-time using the 'storage' event.
 */
export class StateManager<T extends object> {
    private state: T;
    private listeners: Set<StateListener<T>>;
    private storageKey: string;

    constructor(initialState: T, storageKey: string = 'app_global_state') {
        this.storageKey = storageKey;
        this.listeners = new Set();
        
        // Initialize state from storage if available, otherwise use initial
        const savedState = localStorage.getItem(this.storageKey);
        this.state = savedState ? { ...initialState, ...JSON.parse(savedState) } : initialState;

        // Sync state across different tabs and separate JS pages automatically
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey && e.newValue) {
                this.state = JSON.parse(e.newValue);
                this.notify();
            }
        });
    }

    /**
     * Get the current state
     */
    getState(): T {
        return this.state;
    }

    /**
     * Update the state partially. This merges the updates with the current state,
     * saves to localStorage, and notifies all subscribers.
     */
    setState(updates: Partial<T>): void {
        this.state = { ...this.state, ...updates };
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        this.notify();
    }

    /**
     * Subscribe to state changes. Returns an unsubscribe function.
     */
    subscribe(listener: StateListener<T>): () => void {
        this.listeners.add(listener);
        // Immediately notify the new listener with current state
        listener(this.state);
        
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.state));
    }
}

// Define the shape of our global application state
export interface AppState {
    user: any | null;
    isAuthenticated: boolean;
    token: string | null;
    theme: 'dark' | 'light';
    cartItemCount: number;
}

const initialState: AppState = {
    user: null,
    isAuthenticated: false,
    token: null,
    theme: 'dark',
    cartItemCount: 0
};

// Export a singleton instance of the store
export const globalStore = new StateManager<AppState>(initialState, 'chefbook_app_state');
