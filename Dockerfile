FROM nginx:alpine

# Copiar landing
COPY landing/ /usr/share/nginx/html/

# Copiar panel
COPY panel/ /usr/share/nginx/html/panel/

# Configuracion nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
