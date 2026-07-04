## Acceptance criteria
- [ ] `POST /scan` accepts image upload
- [ ] Celery job enqueued; returns `202` with scan id
- [ ] No synchronous CNN in request handler
- [ ] Stub worker writes placeholder classification for mid-eval
