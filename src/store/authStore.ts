import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { User, Session, Subscription } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    clearError: () => void;
    enterDemoMode: () => void;
}

// Keep subscription ref outside store to avoid stale closure issues
let authSubscription: Subscription | null = null;

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    loading: true,
    error: null,

    initialize: async () => {
        // Skip Supabase auth when credentials aren't configured (demo mode)
        if (!isSupabaseConfigured) {
            set({ loading: false });
            return;
        }

        try {
            // Unsubscribe previous listener to prevent duplicates
            if (authSubscription) {
                authSubscription.unsubscribe();
                authSubscription = null;
            }

            const { data: { session } } = await supabase.auth.getSession();
            console.log('🔒 SUPABASE SESSION ON MOUNT:', { session, user: session?.user ?? null });
            set({ session, user: session?.user ?? null, loading: false });

            // Listen for auth changes and store the subscription
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                set({ session, user: session?.user ?? null });
            });
            authSubscription = subscription;
        } catch {
            set({ loading: false });
        }
    },

    signUp: async (email, password, displayName) => {
        set({ loading: true, error: null });
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: displayName } },
        });
        console.log('📝 SUPABASE SIGNUP RESPONSE:', { data, error });

        if (error) {
            set({ error: error.message, loading: false });
            return;
        }

        // Profile row is auto-created by the database trigger
        set({ user: data.user, session: data.session, loading: false });
    },

    signIn: async (email, password) => {
        set({ loading: true, error: null });
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        console.log('🔑 SUPABASE SIGNIN RESPONSE:', { data, error });

        if (error) {
            set({ error: error.message, loading: false });
            return;
        }

        set({ user: data.user, session: data.session, loading: false });
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null });
    },

    clearError: () => set({ error: null }),

    enterDemoMode: () => {
        set({
            user: {
                id: 'demo-user-001',
                email: 'demo@financecopilot.ai',
                user_metadata: { full_name: 'Demo Investor' },
            } as any,
            session: { access_token: 'demo' } as any,
            loading: false,
            error: null,
        });
    },
}));
