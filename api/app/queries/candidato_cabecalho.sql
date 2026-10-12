-- Só campos públicos e necessários. NUNCA selecione titulo_eleitoral, dt_nascimento ou cpf aqui.
SELECT id_candidato, nome_civil, genero, ocupacao FROM candidato WHERE id_candidato = ?
