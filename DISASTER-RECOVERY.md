# GTX Rush — Disaster Recovery Documentation

## Recovery Objectives

| Metric | MVP | Growth | Scale |
|--------|-----|--------|-------|
| RPO (Recovery Point Objective) | 24 hours | 1 hour | 15 minutes |
| RTO (Recovery Time Objective) | 4 hours | 1 hour | 15 minutes |

## Backup Strategy

### Database Backups
- **Automated daily backups** via pg_dump
- **30-day retention** for daily backups
- **7-day retention** for hourly backups (growth stage)
- **Encrypted** at rest
- **Stored** in separate location from primary

### Backup Schedule
```
Daily:   02:00 UTC (full backup)
Hourly:  :00 UTC (incremental, growth stage)
```

### Backup Verification
- Weekly restore test to verify backup integrity
- Monthly full restore test to staging environment
- Documented restore procedures

## Recovery Procedures

### Database Recovery
```bash
# 1. Stop API server
docker compose -f docker-compose.prod.yml stop api

# 2. Restore database from backup
pg_restore -d gtx_rush <backup_file>

# 3. Verify data integrity
psql -d gtx_rush -c "SELECT COUNT(*) FROM users;"

# 4. Start API server
docker compose -f docker-compose.prod.yml start api

# 5. Verify health
curl http://localhost:3001/ready
```

### Application Recovery
```bash
# 1. Pull latest known-good image
docker pull gtx-rush-api:<last-known-good-tag>

# 2. Deploy previous version
docker compose -f docker-compose.prod.yml up -d --force-recreate api

# 3. Verify health
curl http://localhost:3001/health
```

### Redis Recovery
```bash
# Redis is cache-only; no recovery needed
# Just restart and let it rebuild
docker compose -f docker-compose.prod.yml restart redis
```

## Disaster Scenarios

### Scenario 1: Database Corruption
1. Stop all API servers
2. Assess extent of corruption
3. Restore from latest clean backup
4. Apply any valid migrations since backup
5. Restart services
6. Notify affected users if any data loss

### Scenario 2: Complete Server Failure
1. Provision new server
2. Install Docker and dependencies
3. Pull latest images
4. Restore database from off-site backup
5. Configure environment variables
6. Start services
7. Update DNS/load balancer

### Scenario 3: Security Breach
1. **Immediately** revoke all credentials
2. Take affected systems offline
3. Preserve logs for investigation
4. Assess scope of breach
5. Rotate all secrets
6. Restore from clean backup if needed
7. Notify affected users
8. Document and improve

### Scenario 4: Payment System Failure
1. Disable payment processing (kill switch)
2. Notify operations team
3. Investigate root cause
4. Restore payment service
5. Reconcile any failed transactions
6. Resume processing

## Testing Disaster Recovery

### Monthly Tests
- Database backup restore to staging
- Application rollback procedure
- Redis failover (if clustered)

### Quarterly Tests
- Full disaster recovery simulation
- Cross-region backup verification
- Security incident response drill

### Test Documentation
Each test must document:
- Date and time
- What was tested
- Steps taken
- Results
- Issues encountered
- Improvements needed

## Communication Plan

### During Incident
1. Internal: Slack/Telegram notification to team
2. Status page update
3. User notification if user-facing impact

### Post-Incident
1. Postmortem document within 24 hours
2. Action items with owners and deadlines
3. Updated runbook if procedures changed
