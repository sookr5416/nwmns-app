'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Player, Court } from './types';
import CourtSection from './components/CourtSection';

export default function UserHomePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [now, setNow] = useState(Date.now());

  // 타이머
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (startTime: number) => {
    const diff = Math.floor((now - startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // 실시간 데이터 구독
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase.from('players').select('*');
      if (data) setPlayers(data);
    };

    const fetchCourts = async () => {
      const { data } = await supabase.from('courts').select('*').order('order_idx', { ascending: true });
      if (data) setCourts(data);
    };

    fetchPlayers();
    fetchCourts();

    const playersSub = supabase.channel('players_user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchPlayers).subscribe();

    const courtsSub = supabase.channel('courts_user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, fetchCourts).subscribe();

    return () => {
      supabase.removeChannel(playersSub);
      supabase.removeChannel(courtsSub);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <CourtSection 
        viewMode="user" 
        courts={courts} 
        players={players} 
        formatTime={formatTime} 
      />
    </div>
  );
}