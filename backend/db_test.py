import psycopg2

# Datos de conexión - reemplaza por los tuyos

host = "littlefounders-database.cyv4c8swa7o4.us-east-1.rds.amazonaws.com"
port = 5432
user = "postgres"
password = "awsthissdfa;aw2not<1password>"
dbname = "postgres"

# Conexión y consulta de prueba
try:
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname
    )
    cur = conn.cursor()
    cur.execute("SELECT NOW();")
    result = cur.fetchone()
    print("Conexión exitosa. Fecha/Hora:", result)
    cur.close()
    conn.close()
except Exception as e:
    print("Error al conectar:", e)
