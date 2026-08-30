-- =============================================================================
-- OZOAGRO - Migración 001: Schema completo
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- TABLA: config_negocio (una sola fila)
-- =============================================================================
CREATE TABLE IF NOT EXISTS config_negocio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL DEFAULT 'OZOAGRO Colombia',
  logo_url TEXT,
  whatsapp_agente TEXT,
  whatsapp_ceo TEXT,
  telegram_chat_id_ceo TEXT,
  email_ceo TEXT,
  email_remitente TEXT DEFAULT 'noreply@ozoagro.co',
  ciudad TEXT DEFAULT 'Colombia',
  texto_confirmacion TEXT DEFAULT 'Tu pedido ha sido confirmado. Un asesor te contactara pronto.',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: productos (3 combos fijos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  litros INTEGER NOT NULL,
  precio_venta NUMERIC(12,2) NOT NULL,
  costo_unitario NUMERIC(12,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de cambios de costo
CREATE TABLE IF NOT EXISTS productos_costo_historial (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  costo_anterior NUMERIC(12,2),
  costo_nuevo NUMERIC(12,2) NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('panel', 'telegram')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: clientes
-- =============================================================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL DEFAULT 'generico' CHECK (tipo IN ('generico', 'distribuidor')),
  nombre TEXT NOT NULL,
  cedula TEXT UNIQUE,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  ciudad TEXT,
  departamento TEXT,
  pais TEXT DEFAULT 'Colombia',
  cultivo TEXT,
  origen TEXT NOT NULL DEFAULT 'web' CHECK (origen IN ('web', 'tradicional', 'agente')),
  estado_crm TEXT NOT NULL DEFAULT 'por_contactar' CHECK (estado_crm IN ('por_contactar', 'atendido')),
  ultima_compra_fecha TIMESTAMPTZ,
  ultima_compra_cantidad_litros INTEGER,
  ultima_compra_valor NUMERIC(12,2),
  total_comprado_litros INTEGER DEFAULT 0,
  total_comprado_valor NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: pedidos
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_publico TEXT UNIQUE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  canal TEXT NOT NULL DEFAULT 'web' CHECK (canal IN ('web', 'tradicional', 'agente')),
  estado TEXT NOT NULL DEFAULT 'por_confirmar' CHECK (estado IN ('por_confirmar', 'confirmado', 'despachado', 'cerrado', 'cancelado', 'devuelto')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  costo_total NUMERIC(12,2) DEFAULT 0,
  rentabilidad NUMERIC(12,2) DEFAULT 0,
  rentabilidad_negativa BOOLEAN DEFAULT false,
  ciudad_envio TEXT,
  direccion_envio TEXT,
  guia TEXT,
  transportadora TEXT,
  fecha_confirmado TIMESTAMPTZ,
  fecha_despachado TIMESTAMPTZ,
  fecha_cerrado TIMESTAMPTZ,
  fecha_cancelado TIMESTAMPTZ,
  notas TEXT,
  es_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secuencia para codigo publico OZO-00001
CREATE SEQUENCE IF NOT EXISTS pedidos_codigo_seq START 1;

-- =============================================================================
-- TABLA: pedido_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  costo_unitario_snapshot NUMERIC(12,2) NOT NULL,
  litros INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: inventario (kardex simplificado)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'ajuste')),
  unidades INTEGER NOT NULL,
  costo_unitario NUMERIC(12,2) NOT NULL,
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: gastos
-- =============================================================================
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  categoria TEXT,
  metodo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: visitas (tracking landing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS visitas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  fbclid TEXT,
  ttclid TEXT,
  pagina TEXT DEFAULT '/',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: checkouts_abandonados
-- =============================================================================
CREATE TABLE IF NOT EXISTS checkouts_abandonados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT,
  telefono TEXT,
  email TEXT,
  ciudad TEXT,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER DEFAULT 1,
  contactado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLAS: conversaciones del agente
-- =============================================================================
CREATE TABLE IF NOT EXISTS wa_conversaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono TEXT UNIQUE NOT NULL,
  nombre TEXT,
  ultimo_mensaje TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_mensajes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversacion_id UUID REFERENCES wa_conversaciones(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('user', 'assistant', 'system')),
  contenido TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de acciones del CEO por Telegram
CREATE TABLE IF NOT EXISTS agente_acciones_ceo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accion TEXT NOT NULL,
  detalle JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TRIGGER: Generar codigo publico OZO-00001
-- =============================================================================
CREATE OR REPLACE FUNCTION generar_codigo_pedido()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_publico IS NULL THEN
    NEW.codigo_publico := 'OZO-' || LPAD(nextval('pedidos_codigo_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_codigo_pedido ON pedidos;
CREATE TRIGGER trg_generar_codigo_pedido
  BEFORE INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION generar_codigo_pedido();

-- =============================================================================
-- TRIGGER: Recalcular totales del pedido
-- =============================================================================
CREATE OR REPLACE FUNCTION recalcular_totales_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_costo_total NUMERIC(12,2);
BEGIN
  SELECT
    COALESCE(SUM(precio_unitario * cantidad), 0),
    COALESCE(SUM(costo_unitario_snapshot * cantidad), 0)
  INTO v_subtotal, v_costo_total
  FROM pedido_items
  WHERE pedido_id = COALESCE(NEW.pedido_id, OLD.pedido_id);

  UPDATE pedidos
  SET
    subtotal = v_subtotal,
    costo_total = v_costo_total,
    rentabilidad = v_subtotal - v_costo_total,
    rentabilidad_negativa = (v_subtotal - v_costo_total) < 0,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.pedido_id, OLD.pedido_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalcular_totales ON pedido_items;
CREATE TRIGGER trg_recalcular_totales
  AFTER INSERT OR UPDATE OR DELETE ON pedido_items
  FOR EACH ROW
  EXECUTE FUNCTION recalcular_totales_pedido();

-- =============================================================================
-- TRIGGER: Actualizar cliente al cerrar pedido
-- =============================================================================
CREATE OR REPLACE FUNCTION actualizar_cliente_pedido_cerrado()
RETURNS TRIGGER AS $$
DECLARE
  v_litros INTEGER;
BEGIN
  IF NEW.estado = 'cerrado' AND OLD.estado != 'cerrado' AND NEW.cliente_id IS NOT NULL THEN
    SELECT COALESCE(SUM(litros * cantidad), 0) INTO v_litros
    FROM pedido_items WHERE pedido_id = NEW.id;

    UPDATE clientes
    SET
      ultima_compra_fecha = NOW(),
      ultima_compra_cantidad_litros = v_litros,
      ultima_compra_valor = NEW.subtotal,
      total_comprado_litros = total_comprado_litros + v_litros,
      total_comprado_valor = total_comprado_valor + NEW.subtotal,
      estado_crm = 'atendido',
      updated_at = NOW()
    WHERE id = NEW.cliente_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_cliente_cerrado ON pedidos;
CREATE TRIGGER trg_actualizar_cliente_cerrado
  AFTER UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_cliente_pedido_cerrado();

-- =============================================================================
-- SEED: Datos iniciales
-- =============================================================================

-- Config negocio
INSERT INTO config_negocio (nombre) VALUES ('OZOAGRO Colombia')
ON CONFLICT DO NOTHING;

-- Productos (3 combos)
INSERT INTO productos (nombre, litros, precio_venta, costo_unitario) VALUES
  ('Combo 1 Litro', 1, 130000, 65000),
  ('Combo 2 Litros', 2, 250000, 130000),
  ('Combo 3 Litros', 3, 300000, 195000)
ON CONFLICT DO NOTHING;
