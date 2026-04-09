from app.workers.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, name="app.workers.sync.sync_user_submissions")
def sync_user_submissions(self, user_id: str):
    # Implemented in Stage 2
    raise NotImplementedError("Sync engine not yet implemented — coming in Stage 2")
