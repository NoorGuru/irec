def _compute_score_for_recs(recs, now, fallback_days) -> int:
    if not recs: return 0
    import statistics
    import math
    from app.today_routes import parse_iso_datetime
    
    total_weight = 0.0
    weighted_sentiment_sum = 0.0
    sentiments = []
    convictions = []
    for rec in recs:
        sentiment = rec.get("sentiment", 0)
        sentiments.append(sentiment)
        convictions.append(rec.get("conviction_level", 5))
        channel = (rec.get("videos") or {}).get("channels") or {}
        trust_weight = channel.get("trust_weight") or 1.0
        total_weight += trust_weight
        weighted_sentiment_sum += sentiment * trust_weight
        
    consensus_sentiment = (weighted_sentiment_sum / total_weight if total_weight > 0 else sum(sentiments) / len(sentiments))
    direction = "BUY" if consensus_sentiment >= 0 else "SELL"
    avg_conviction = sum(convictions) / len(convictions)
    stddev = statistics.pstdev(sentiments) if len(sentiments) > 1 else 0.0
    agreement_pct = int(max(0, min(1, 1.0 - (stddev / 2.0))) * 100)
    
    latest_pub_date = None
    seven_days_ago = now - timedelta(days=7)
    recent_sentiments = []
    older_sentiments = []
    
    for rec in recs:
        pub_str = (rec.get("videos") or {}).get("published_at")
        if pub_str:
            pub_dt = parse_iso_datetime(pub_str)
            if latest_pub_date is None or pub_dt > latest_pub_date:
                latest_pub_date = pub_dt
            if pub_dt >= seven_days_ago:
                recent_sentiments.append(rec.get("sentiment", 0))
            else:
                older_sentiments.append(rec.get("sentiment", 0))

    if latest_pub_date is None:
        from datetime import timedelta
        latest_pub_date = now - timedelta(days=fallback_days)

    days_since_latest = (now - latest_pub_date).total_seconds() / 86400.0
    recency_score = math.exp(-max(0.0, days_since_latest) / 7.0) * 100.0
    
    direction_sign = 1 if consensus_sentiment >= 0 else -1
    if recent_sentiments and older_sentiments:
        avg_recent = sum(recent_sentiments) / len(recent_sentiments)
        avg_older = sum(older_sentiments) / len(older_sentiments)
        delta = (avg_recent - avg_older) * direction_sign
        momentum_score = 50.0 + (delta / 4.0) * 50.0
    elif recent_sentiments:
        momentum_score = 75.0
    else:
        momentum_score = 25.0
        
    abs_sentiment = abs(consensus_sentiment)
    if abs_sentiment <= 1.0:
        sentiment_score = 50.0 + (abs_sentiment * 25.0)
    else:
        sentiment_score = 75.0 + ((abs_sentiment - 1.0) * 25.0)
    sentiment_score = min(100.0, max(0.0, sentiment_score))
    
    conviction_score = avg_conviction * 10.0
    action_score_raw = (0.25 * sentiment_score + 0.20 * conviction_score + 0.20 * agreement_pct + 0.20 * recency_score + 0.15 * momentum_score)
    
    analyst_names = list(set([((rec.get("videos") or {}).get("channels") or {}).get("channel_name", "Unknown Analyst") for rec in recs]))
    analyst_count = len(analyst_names)
    
    if direction == "SELL":
        analyst_multiplier = min(1.0, 0.8 + 0.1 * analyst_count)
    else:
        if analyst_count >= 4: analyst_multiplier = 1.0
        elif analyst_count == 3: analyst_multiplier = 0.8
        elif analyst_count == 2: analyst_multiplier = 0.6
        else: analyst_multiplier = 0.5
        
    return int(max(0, min(100, action_score_raw * analyst_multiplier)))

