import time
import threading
import uuid

class ProgressTracker:
    """
    Thread-safe global tracker for active transfer operations.
    Stores real byte counts, labels, and statuses in memory.
    """
    _tasks = {}
    _lock = threading.Lock()
    _cancel_flags = {}

    @classmethod
    def create_task(cls, task_id: str, label: str, total_bytes: int = 0):
        with cls._lock:
            cls._tasks[task_id] = {
                'task_id': task_id,
                'label': label,
                'transferred': 0,
                'total': total_bytes,
                'status': 'running',  # running, done, error, cancelled
                'error': None,
                'start_time': time.time()
            }

    @classmethod
    def update(cls, task_id: str, transferred: int, total: int = None):
        with cls._lock:
            if task_id in cls._tasks:
                cls._tasks[task_id]['transferred'] = transferred
                if total is not None:
                    cls._tasks[task_id]['total'] = total

    @classmethod
    def complete(cls, task_id: str, error: str = None):
        with cls._lock:
            if task_id in cls._tasks:
                cls._tasks[task_id]['status'] = 'error' if error else 'done'
                if error:
                    cls._tasks[task_id]['error'] = error
                # Ensure total > 0 so UI doesn't divide by zero
                if cls._tasks[task_id]['total'] == 0:
                    cls._tasks[task_id]['total'] = 1
                    cls._tasks[task_id]['transferred'] = 1

    @classmethod
    def get(cls, task_id: str):
        with cls._lock:
            return cls._tasks.get(task_id)

    @classmethod
    def cleanup(cls, task_id: str):
        with cls._lock:
            cls._tasks.pop(task_id, None)

    @classmethod
    def generate_id(cls) -> str:
        return 'task_' + str(uuid.uuid4())[:8]

    @classmethod
    def request_cancel(cls, task_id: str):
        """Flag a task/request as cancelled. Workers poll is_cancelled() and stop."""
        now = time.time()
        with cls._lock:
            # drop stale flags so the dict cannot grow forever
            for k in [k for k, t in cls._cancel_flags.items() if now - t > 600]:
                cls._cancel_flags.pop(k, None)
            cls._cancel_flags[task_id] = now
            if task_id in cls._tasks:
                cls._tasks[task_id]['status'] = 'cancelled'

    @classmethod
    def is_cancelled(cls, task_id) -> bool:
        if not task_id:
            return False
        with cls._lock:
            return task_id in cls._cancel_flags

    @classmethod
    def clear_cancel(cls, task_id):
        with cls._lock:
            cls._cancel_flags.pop(task_id, None)

    @classmethod
    def cancel_done(cls, task_id: str):
        with cls._lock:
            if task_id in cls._tasks:
                cls._tasks[task_id]['status'] = 'cancelled'