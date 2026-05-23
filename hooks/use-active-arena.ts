"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type UserArena = {
  id: string;
  user_id: string;
  arena_id: string;
  role: "owner" | "manager" | "staff";
  arena: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
};

const ACTIVE_ARENA_KEY = "arenaflow_active_arena_id";

export function useActiveArena() {
  const [arenas, setArenas] = useState<UserArena[]>([]);
  const [activeArenaId, setActiveArenaIdState] = useState("");
  const [loading, setLoading] = useState(true);

  const activeArena = useMemo(() => {
    return arenas.find((item) => item.arena_id === activeArenaId) || null;
  }, [arenas, activeArenaId]);

  const activeArenaInfo = activeArena?.arena || null;

  useEffect(() => {
    loadArenas();
  }, []);

  async function loadArenas() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    let merged: UserArena[] = [];

    const { data: userArenaRows } = await supabase
      .from("user_arenas")
      .select("id, user_id, arena_id, role")
      .eq("user_id", user.id);

    if (userArenaRows && userArenaRows.length > 0) {
      const arenaIds = userArenaRows.map((row) => row.arena_id);

      const { data: arenaRows } = await supabase
        .from("arenas")
        .select("id, name, logo_url")
        .in("id", arenaIds);

      merged = userArenaRows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        arena_id: row.arena_id,
        role: row.role || "owner",
        arena: arenaRows?.find((arena) => arena.id === row.arena_id) || null,
      })) as UserArena[];
    }

    if (merged.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, arena_id")
        .eq("id", user.id)
        .single();

      if (profile?.arena_id) {
        const { data: arena } = await supabase
          .from("arenas")
          .select("id, name, logo_url")
          .eq("id", profile.arena_id)
          .single();

        merged = [
          {
            id: profile.arena_id,
            user_id: user.id,
            arena_id: profile.arena_id,
            role: "owner",
            arena: arena || null,
          },
        ];
      }
    }

    setArenas(merged);

    const savedArenaId =
      typeof window !== "undefined"
        ? localStorage.getItem(ACTIVE_ARENA_KEY)
        : null;

    const validSavedArena = merged.find(
      (item) => item.arena_id === savedArenaId
    );

    if (validSavedArena) {
      setActiveArenaIdState(validSavedArena.arena_id);
    } else if (merged.length > 0) {
      setActiveArenaIdState(merged[0].arena_id);
      localStorage.setItem(ACTIVE_ARENA_KEY, merged[0].arena_id);
    } else {
      setActiveArenaIdState("");
      localStorage.removeItem(ACTIVE_ARENA_KEY);
    }

    setLoading(false);
  }

  function setActiveArenaId(arenaId: string) {
    setActiveArenaIdState(arenaId);
    localStorage.setItem(ACTIVE_ARENA_KEY, arenaId);
  }

  return {
    arenas,
    activeArena,
    activeArenaInfo,
    activeArenaId,
    setActiveArenaId,
    loading,
    reloadArenas: loadArenas,
  };
}