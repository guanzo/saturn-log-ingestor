#!/usr/bin/env bash

trap "docker stop saturn-postgres; trap - SIGTERM && kill -- -$$ 2> /dev/null" SIGINT SIGTERM EXIT

export PGUSER=postgres
export PGPASSWORD=pgpassword
export PGDATABASE=postgres
export PGHOST=localhost
export PGPORT=5438

npx lambda-local -l src/lambda.js --watch 8040 &

# To use psql CLI:
#
#   docker exec -it saturn-postgres psql -U postgres
#
docker volume create saturn-postgres-volume
docker run --rm --name saturn-postgres -p $PGPORT:5432 \
    -v saturn-postgres-volume:/var/lib/postgresql/data \
    -e POSTGRES_PASSWORD=$PGPASSWORD \
    postgres:13.3 &

wait
