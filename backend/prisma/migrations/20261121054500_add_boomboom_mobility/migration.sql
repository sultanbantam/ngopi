-- CreateTable boomboom_driver_profiles
CREATE TABLE IF NOT EXISTS "boomboom_driver_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ngopi_id" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL DEFAULT 'motor_ev',
    "vehicle_plate" TEXT NOT NULL,
    "vehicle_model" TEXT,
    "service_area" TEXT NOT NULL DEFAULT 'Jabodetabek',
    "is_ev" BOOLEAN NOT NULL DEFAULT true,
    "is_online" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "total_trips" INTEGER NOT NULL DEFAULT 0,
    "total_points_earned" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boomboom_driver_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "boomboom_driver_profiles_user_id_key" ON "boomboom_driver_profiles"("user_id");

-- CreateTable boomboom_trips
CREATE TABLE IF NOT EXISTS "boomboom_trips" (
    "id" TEXT NOT NULL,
    "passenger_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "service_type" TEXT NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "destination_address" TEXT NOT NULL,
    "pickup_lat" DOUBLE PRECISION,
    "pickup_lng" DOUBLE PRECISION,
    "dest_lat" DOUBLE PRECISION,
    "dest_lng" DOUBLE PRECISION,
    "distance_km" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "estimated_fare_idr" INTEGER NOT NULL DEFAULT 0,
    "is_ev" BOOLEAN NOT NULL DEFAULT true,
    "passenger_points" INTEGER NOT NULL DEFAULT 0,
    "driver_points" INTEGER NOT NULL DEFAULT 0,
    "passenger_tx_id" TEXT,
    "driver_tx_id" TEXT,
    "notes" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'requested',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boomboom_trips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "boomboom_trips_passenger_id_created_at_idx" ON "boomboom_trips"("passenger_id", "created_at");
CREATE INDEX IF NOT EXISTS "boomboom_trips_driver_id_created_at_idx" ON "boomboom_trips"("driver_id", "created_at");
CREATE INDEX IF NOT EXISTS "boomboom_trips_status_created_at_idx" ON "boomboom_trips"("status", "created_at");
