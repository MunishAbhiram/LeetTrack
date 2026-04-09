from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.scheduled.decay_mastery_scores")
def decay_mastery_scores():
    # Implemented in Stage 3
    pass


@celery_app.task(name="app.workers.scheduled.compute_srs_due")
def compute_srs_due():
    # Implemented in Stage 4
    pass


@celery_app.task(name="app.workers.scheduled.weekly_summary")
def weekly_summary():
    # Implemented in Stage 3
    pass


@celery_app.task(name="app.workers.scheduled.detect_plateaus")
def detect_plateaus():
    # Implemented in Stage 3
    pass
