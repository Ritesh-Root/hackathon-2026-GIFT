/**
 * Supabase Data Service
 * Central data-access layer for all Supabase tables.
 * Handles CRUD operations and Realtime subscriptions.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Types ──

export interface DbMessage {
    id: string;
    user_id: string;
    username: string;
    avatar: string;
    text: string;
    created_at: string;
}

export interface DbPrediction {
    id: string;
    user_id: string;
    ticker: string;
    user_prediction: 'BULLISH' | 'BEARISH';
    ai_prediction: 'BULLISH' | 'BEARISH';
    ai_confidence: number;
    ai_reasoning: string;
    is_correct: boolean;
    created_at: string;
}

export interface DbHolding {
    id: string;
    user_id: string;
    ticker: string;
    company_name: string;
    shares: number;
    avg_cost: number;
    sector: string;
    created_at: string;
    updated_at: string;
}

export interface DbUserProgress {
    id: string;
    user_id: string;
    module_id: string;
    progress: number;
    quiz_score: number | null;
    completed_at: string | null;
    updated_at: string;
}

// ── Messages (Community Chat) ──

export async function fetchMessages(limit = 50): Promise<DbMessage[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) {
        console.error('fetchMessages error:', error);
        return [];
    }
    return data ?? [];
}

export async function sendMessage(
    userId: string,
    username: string,
    avatar: string,
    text: string
): Promise<DbMessage | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
        .from('messages')
        .insert({ user_id: userId, username, avatar, text })
        .select()
        .single();

    if (error) {
        console.error('sendMessage error:', error);
        return null;
    }
    return data;
}

export function subscribeToMessages(
    onNewMessage: (msg: DbMessage) => void
): RealtimeChannel {
    if (!isSupabaseConfigured) {
        return supabase.channel('noop');
    }
    const channel = supabase
        .channel('public:messages')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
                onNewMessage(payload.new as DbMessage);
            }
        )
        .subscribe();

    return channel;
}

export function unsubscribeFromMessages(channel: RealtimeChannel): void {
    supabase.removeChannel(channel);
}

// ── Predictions ──

export async function savePrediction(prediction: {
    user_id: string;
    ticker: string;
    user_prediction: 'BULLISH' | 'BEARISH';
    ai_prediction: 'BULLISH' | 'BEARISH';
    ai_confidence: number;
    ai_reasoning: string;
    is_correct: boolean;
}): Promise<DbPrediction | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
        .from('predictions')
        .insert(prediction)
        .select()
        .single();

    if (error) {
        console.error('savePrediction error:', error);
        return null;
    }
    return data;
}

export async function fetchUserPredictions(
    userId: string,
    limit = 20
): Promise<DbPrediction[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('fetchUserPredictions error:', error);
        return [];
    }
    return data ?? [];
}

// ── Holdings (Portfolio) ──

export async function fetchHoldings(userId: string): Promise<DbHolding[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('fetchHoldings error:', error);
        return [];
    }
    return data ?? [];
}

export async function upsertHolding(
    holding: Omit<DbHolding, 'id' | 'created_at' | 'updated_at'>
): Promise<DbHolding | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
        .from('holdings')
        .upsert(holding, { onConflict: 'user_id,ticker' })
        .select()
        .single();

    if (error) {
        // If upsert fails due to no unique constraint on user_id,ticker, insert instead
        const { data: insertData, error: insertError } = await supabase
            .from('holdings')
            .insert(holding)
            .select()
            .single();

        if (insertError) {
            console.error('upsertHolding error:', insertError);
            return null;
        }
        return insertData;
    }
    return data;
}

export async function deleteHolding(holdingId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase
        .from('holdings')
        .delete()
        .eq('id', holdingId);

    if (error) {
        console.error('deleteHolding error:', error);
        return false;
    }
    return true;
}

// ── User Progress (Learning) ──

export async function fetchUserProgress(
    userId: string
): Promise<DbUserProgress[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('fetchUserProgress error:', error);
        return [];
    }
    return data ?? [];
}

export async function updateUserProgress(
    userId: string,
    moduleId: string,
    progress: number,
    quizScore?: number
): Promise<DbUserProgress | null> {
    if (!isSupabaseConfigured) return null;
    const payload: Record<string, unknown> = {
        user_id: userId,
        module_id: moduleId,
        progress,
        updated_at: new Date().toISOString(),
    };

    if (quizScore !== undefined) {
        payload.quiz_score = quizScore;
    }
    if (progress >= 100) {
        payload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
        .from('user_progress')
        .upsert(payload, { onConflict: 'user_id,module_id' })
        .select()
        .single();

    if (error) {
        console.error('updateUserProgress error:', error);
        return null;
    }
    return data;
}

// ── Utility: Check if user is demo ──

export function isDemoUser(userId: string): boolean {
    return userId === 'demo-user-001';
}
