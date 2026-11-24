"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase/client";

type PublishedReview = {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

type ReviewAccess = {
  signed_in: boolean;
  purchased: boolean;
  review_status: "pending" | "approved" | "rejected" | null;
};

export function StarRow({ rating }: { rating: number }) {
  return (
    <span className="star-row" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Math.round(rating) ? "star filled" : "star"} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

export default function ProductReviews({
  productId,
  onSignIn,
}: {
  productId: number;
  onSignIn: () => void;
}) {
  const [reviews, setReviews] = useState<PublishedReview[]>([]);
  const [access, setAccess] = useState<ReviewAccess | null>(null);
  const [purchaseKnown, setPurchaseKnown] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!supabase) return;
    const [reviewResult, accessResult] = await Promise.all([
      supabase.from("reviews").select("id,customer_name,rating,comment,created_at").eq("product_id", productId).eq("status", "approved").order("created_at", { ascending: false }),
      supabase.rpc("review_access", { p_product_id: productId }),
    ]);
    if (!reviewResult.error) setReviews((reviewResult.data ?? []) as PublishedReview[]);
    if (!accessResult.error && accessResult.data && typeof accessResult.data === "object" && !Array.isArray(accessResult.data)) {
      setAccess(accessResult.data as ReviewAccess);
      setPurchaseKnown(true);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setPurchaseKnown(false);
    setAccess({ signed_in: Boolean(data.session), purchased: false, review_status: null });
  };

  useEffect(() => {
    void load();
  }, [productId]);

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: submitError } = await supabase.rpc("submit_product_review", {
      p_product_id: productId,
      p_rating: rating,
      p_comment: comment,
    });
    setBusy(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    setComment("");
    await load();
  };

  const canWrite = purchaseKnown && access?.signed_in && access.purchased && (access.review_status === null || access.review_status === "rejected");

  return (
    <section className="reviews" aria-label="Ratings and reviews">
      <div className="reviews-summary">
        {reviews.length > 0 ? (
          <>
            <StarRow rating={average} />
            <strong>{average.toFixed(1)}</strong>
            <span>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
          </>
        ) : <span>No reviews yet</span>}
      </div>

      {access && !access.signed_in && (
        <button type="button" className="review-note-button" onClick={onSignIn}>Sign in to review a part you have bought</button>
      )}
      {access?.signed_in && purchaseKnown && !access.purchased && (
        <p className="review-note">You can rate this part after you buy it.</p>
      )}
      {access?.signed_in && !purchaseKnown && (
        <p className="review-note">Reviews open after a completed purchase. The review check is not installed in the database yet.</p>
      )}
      {access?.review_status === "pending" && (
        <p className="review-note">Your review is waiting for approval.</p>
      )}
      {access?.review_status === "approved" && (
        <p className="review-note">Your review is published.</p>
      )}
      {access?.review_status === "rejected" && (
        <p className="review-note">Your last review was not published. You can send another.</p>
      )}

      {canWrite && (
        <form className="review-form" onSubmit={submit}>
          <div className="review-stars" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" className={star <= rating ? "active" : ""} aria-checked={star === rating} role="radio" onClick={() => setRating(star)}>{star}★</button>
            ))}
          </div>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} minLength={2} maxLength={400} required placeholder="How did this part fit?" />
          {error && <p className="checkout-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send review"}</button>
        </form>
      )}

      <div className="review-list">
        {reviews.map((review) => (
          <article key={review.id}>
            <div><StarRow rating={review.rating} /><strong>{review.customer_name}</strong></div>
            <p>{review.comment}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
