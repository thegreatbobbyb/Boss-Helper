module.exports = function BossHelper(mod) {
	const Message = require('../tera-message')
	const MSG = new Message(mod)
	
	if (mod.proxyAuthor !== 'caali') {
		const options = require('./module').options
		if (options) {
			const settingsVersion = options.settingsVersion
			if (settingsVersion) {
				mod.settings = require('./' + (options.settingsMigrator || 'settings_migrator.js'))(mod.settings._version, settingsVersion, mod.settings)
				mod.settings._version = settingsVersion
			}
		}
	}
	
	let mobid = [],
		boss = null,
		bossName = null,
		sysMsg = null,
		bossHunting = 0,
		bossTemplate = 0
	
	mod.command.add("怪物", (arg) => {
		if (!arg) {
			mod.settings.enabled = !mod.settings.enabled
			MSG.chat("Boss-Helper " + (mod.settings.enabled ? BLU("开启") : YEL("关闭")))
			if (!mod.settings.enabled) {
				for (let i of mobid) {
					despawnItem(i)
				}
			}
		} else {
			switch (arg) {
				case "警告":
					mod.settings.alerted = !mod.settings.alerted
					MSG.chat("警告消息 " + (mod.settings.alerted ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "通知":
					mod.settings.notice = !mod.settings.notice
					MSG.chat("通知消息 " + (mod.settings.notice ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "消息":
					mod.settings.messager = !mod.settings.messager
					MSG.chat("消息记录 " + (mod.settings.messager ? BLU("启用") : YEL("禁用")))
					break
				case "标记":
					mod.settings.marker = !mod.settings.marker
					MSG.chat("标记位置 " + (mod.settings.marker ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "清除":
					MSG.chat("Boss-Helper " + TIP("清除怪物标记"))
					for (let i of mobid) {
						despawnItem(i)
					}
					break
				case "查询":
					for (const info of mod.settings.bosses) {
						if (info.killedTime != null) {
							var nextTime = new Date(info.killedTime + 5*60*60*1000)
							MSG.chat(MSG.RED(info.name) + " 下次刷新 " + MSG.TIP( nextTime.toLocaleString() ))
						}
					}
					break
				default:
					MSG.chat("Boss-Helper " + MSG.RED("参数错误!"))
					break
			}
		}
	})
	
	mod.game.me.on('change_zone', (zone, quick) => {
		mobid = []
	})
	
	mod.hook('S_SPAWN_NPC', 11, (event) => {
		if (!mod.settings.enabled) return
		
		whichBoss(event.huntingZoneId, event.templateId)
		if (boss) {
			if (mod.settings.marker) {
				spawnItem(event.gameId, event.loc)
				mobid.push(event.gameId)
			}
			if (mod.settings.alerted) {
				MSG.alert(("发现 " + boss.name), 44)
			}
			if (mod.settings.notice) {
				MSG.raids("发现 " + boss.name)
			}
		}
	})
	
	mod.hook('S_DESPAWN_NPC', 3, {order: -100}, (event) => {
		if (!mobid.includes(event.gameId)) return
		
		whichBoss(event.huntingZoneId, event.templateId)
		if (boss) {
			if (event.type == 5) {
				if (mod.settings.alerted) {
					MSG.alert((boss.name + " 被击杀"), 44)
				}
				if (mod.settings.notice) {
					MSG.raids(boss.name + " 被击杀")
				}
			} else if (event.type == 1) {
				if (mod.settings.alerted) {
					MSG.alert((boss.name + " ...超出范围"), 44)
				}
				if (mod.settings.notice) {
					MSG.raids(boss.name + " ...超出范围")
				}
			}
		}
		
		despawnItem(event.gameId)
		mobid.splice(mobid.indexOf(event.gameId), 1)
	})
	
	mod.hook('S_SYSTEM_MESSAGE', 1, (event) => {
		if (!mod.settings.enabled) return
		
		sysMsg = mod.parseSystemMessage(event.message)
		switch (sysMsg.id) {
			case 'SMT_FIELDBOSS_APPEAR':
				getBossMsg(sysMsg.tokens.npcName)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					if (mod.settings.messager) {
						MSG.chat(MSG.BLU("已刷新世界BOSS ") + MSG.RED(boss.name))
						console.log(new Date().toTimeString() + " 刷新 " + boss.name)
					}
				}
				break
			case 'SMT_FIELDBOSS_DIE_GUILD':
			case 'SMT_FIELDBOSS_DIE_NOGUILD':
				getBossMsg(sysMsg.tokens.npcname)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					if (mod.settings.messager) {
						MSG.chat(MSG.YEL(sysMsg.tokens.userName) + " 成功击杀 " + MSG.RED(boss.name))
						
						var nextTime = new Date(Date.now() + 5*60*60*1000)
						MSG.chat("下次刷新 " + MSG.TIP( nextTime.toLocaleString() ))
						
						console.log(new Date().toTimeString() + " 击杀 " + boss.name + " 下次 " + nextTime.toLocaleString())
					}
					
					for (let i=0; i < mod.settings.bosses.length; i++) {
						if (mod.settings.bosses[i].huntingZoneId == bossHunting && mod.settings.bosses[i].templateId == bossTemplate) {
							mod.settings.bosses[i].killedTime = Date.now()
							mod.settings.bosses[i].nextTime = nextTime.toLocaleString()
						}
					}
				}
				break
			default :
				break
		}
	})
	
	function getBossMsg(id) {
		switch (id) {
			case '@creature:26#5001':
				bossHunting = 26
				bossTemplate = 5001
				return
			case '@creature:39#501':
				bossHunting = 39
				bossTemplate = 501
				return
			case '@creature:51#4001':
				bossHunting = 51
				bossTemplate = 4001
				return
			default :
				bossHunting = 0
				bossTemplate = 0
				return
		}
	}
	
	function whichBoss(h_ID, t_ID) {
		if (mod.settings.bosses.find(b => b.huntingZoneId == h_ID && b.templateId == t_ID)) {
			boss = mod.settings.bosses.find(b => b.huntingZoneId == h_ID && b.templateId == t_ID)
		} else {
			boss = null
		}
	}
	/* 
	mod.hook('S_TARGET_INFO', 1, (event) => {
		if (mobid.includes(event.target)) {
			console.log("S_TARGET_INFO - HP-Level")
			console.log(event.hp)
			console.log("------")
		}
	})
	
	mod.hook('S_BOSS_GAGE_INFO', 3, (event) => {
		if (mobid.includes(event.id)) {
			console.log("S_BOSS_GAGE_INFO - HP-Level")
			console.log(event.curHp/event.maxHp)
		}
	})
	 */
	function spawnItem(gameId, loc) {
		loc.z = loc.z - 100
		mod.send('S_SPAWN_DROPITEM', 7, {
			gameId: gameId*100n,
			loc: loc,
			item: mod.settings.itemId,
			amount: 1,
			expiry: 600000,
			owners: [{
				id: 0
			}]
		})
	}
	
	function despawnItem(gameId) {
		mod.send('S_DESPAWN_DROPITEM', 4, {
			gameId: gameId*100n
		})
	}
	
}
