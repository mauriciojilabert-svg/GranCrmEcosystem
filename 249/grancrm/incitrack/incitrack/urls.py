from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.contrib.auth import views as auth_views
import os

from tickets.api import api as ninja_api

urlpatterns = [
    path('incitrack/api/v1/', ninja_api.urls),
    path('incitrack/login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('incitrack/logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('incitrack/', include('tickets.urls')),
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': os.path.join(str(settings.BASE_DIR), 'assets')}),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
