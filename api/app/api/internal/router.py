from fastapi.routing import APIRouter

from .routers import meta, operations, users

router = APIRouter()

router.include_router(meta.router)
router.include_router(users.router)
router.include_router(operations.router)
