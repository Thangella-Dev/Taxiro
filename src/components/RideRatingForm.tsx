"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase } from "@/lib/supabase";
import type { RideRating } from "@/types/database";

export function RideRatingForm({
  reviewerId,
  revieweeId,
  rideId,
}: {
  reviewerId: string;
  revieweeId: string;
  rideId: string;
}) {
  const [comment, setComment] = useState("");
  const [existing, setExisting] = useState<RideRating | null>(null);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let ignore = false;

    void supabase
      .from("ride_ratings")
      .select("*")
      .eq("ride_id", rideId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!ignore && data) setExisting(data as RideRating);
      });

    return () => {
      ignore = true;
    };
  }, [reviewerId, rideId]);

  async function submit() {
    const supabase = getSupabase();
    if (!supabase) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("ride_ratings")
      .insert({
        comment: comment.trim() || null,
        rating,
        reviewee_id: revieweeId,
        reviewer_id: reviewerId,
        ride_id: rideId,
      })
      .select("*")
      .single();
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    setExisting(data as RideRating);
    setMessage("Thank you for rating this ride.");
  }

  if (existing) {
    return (
      <div className="rounded-2xl bg-secondary p-4">
        <p className="font-black">Your rating</p>
        <p className="mt-1 flex items-center gap-1 text-sm">
          <Star className="size-4 fill-current" /> {existing.rating} / 5
        </p>
        {existing.comment ? <p className="mt-2 text-sm">{existing.comment}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-muted p-4">
      <p className="font-black">Rate this ride</p>
      <div className="mt-3 flex gap-1" aria-label="Ride rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            aria-label={value + " stars"}
            className="rounded-full p-2 transition hover:bg-card"
            key={value}
            onClick={() => setRating(value)}
            type="button"
          >
            <Star className={value <= rating ? "size-5 fill-current text-amber-500" : "size-5 text-muted-foreground"} />
          </button>
        ))}
      </div>
      <Input
        className="mt-3"
        maxLength={240}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Optional feedback"
        value={comment}
      />
      <Button className="mt-3 rounded-full" disabled={saving} onClick={() => void submit()}>
        {saving ? "Submitting..." : "Submit rating"}
      </Button>
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
