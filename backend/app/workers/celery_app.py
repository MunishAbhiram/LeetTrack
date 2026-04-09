from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "grindstone",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.sync",
        "app.workers.scheduled",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,
)

celery_app.conf.beat_schedule = {
    "decay-mastery-scores": {
        "task": "app.workers.scheduled.decay_mastery_scores",
        "schedule": crontab(hour=0, minute=0),
    },
    "compute-srs-due": {
        "task": "app.workers.scheduled.compute_srs_due",
        "schedule": crontab(hour=6, minute=0),
    },
    "weekly-summary": {
        "task": "app.workers.scheduled.weekly_summary",
        "schedule": crontab(hour=8, minute=0, day_of_week=0),
    },
    "detect-plateaus": {
        "task": "app.workers.scheduled.detect_plateaus",
        "schedule": crontab(hour=1, minute=0, day_of_week=1),
    },
}
