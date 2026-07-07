from .tenant_middleware import get_current_db


class TenantDatabaseRouter:
    """
    Redirige todos los reads/writes a la BD del tenant actual.
    Las migraciones solo corren en 'default'.
    """
    def db_for_read(self, model, **hints):
        return get_current_db()

    def db_for_write(self, model, **hints):
        return get_current_db()

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == 'default'
