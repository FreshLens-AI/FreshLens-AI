import os

from celery import Celery

app = Celery(
    "freshlens",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
    include=["worker.tasks"],
)

app.conf.beat_schedule = {
    "evaluate-batch-lifecycle-hourly": {
        "task": "enqueue_batch_lifecycle_checks",
        "schedule": 60 * 60,
    }
}
