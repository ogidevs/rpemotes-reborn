EmoteData = {}
local isMenuOpen = false
local QBCore = exports['qb-core']:GetCoreObject()

local function sendSharedEmoteRequest(emoteName)
    local target, distance = GetClosestPlayer()
    if (distance ~= -1 and distance < 3) then
        TriggerServerEvent("rpemotes:server:requestEmote", GetPlayerServerId(target), emoteName)
        SimpleNotify(Translate('sentrequestto') .. emoteName, "success")
    else
        SimpleNotify(Translate('nobodyclose'), "error")
    end
end

function OpenEmoteMenu()
    if isMenuOpen then CloseEmoteMenu() return end
    if IsEntityDead(PlayerPedId()) or (IsPedSwimming(PlayerPedId()) and not Config.AllowInWater) then return end
    isMenuOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = "setVisible", status = true, locale = Config.MenuLanguage })
end

function CloseEmoteMenu()
    if not isMenuOpen then return end
    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = "setVisible", status = false })
end

RegisterNUICallback('playEmote', function(data, cb)
    if LocalPlayer.state.isDead or LocalPlayer.state.isInLastStand then return cb('error') end
    if data.category == 'Shared' then
        sendSharedEmoteRequest(data.name)
        CloseEmoteMenu()
    elseif data.category == "Walks" then
        WalkMenuStart(data.name, false)
        CloseEmoteMenu()
    elseif data.category == "Expressions" then
        SetPlayerPedExpression(data.name, true)
        CloseEmoteMenu()
    else
        if data.name and data.category then CloseEmoteMenu(); EmoteMenuStart(data.name, data.category) end
    end
    cb('ok')
end)

RegisterNUICallback('getKeybinds', function(data, cb)
    local keybindsData = {}
    for i = 1, #Config.KeybindKeys do
        local emote = GetResourceKvpString(string.format('%s_emob%s', Config.keybindKVP, i))
        table.insert(keybindsData, {
            emote = emote and emote ~= "" and emote or false
        })
    end
    cb(keybindsData)
end)

RegisterNUICallback('bindEmote', function(data, cb)
    local numkey = tonumber(data.key)
    local emote = tostring(data.emote)

    if numkey and emote then
        local args = { tostring(numkey), emote }
        EmoteBindStart(source, args, "")
        cb({ status = 'ok', message = 'Animacija "'..emote..'" vezana za slot '..numkey..'.' })
    else
        cb({ status = 'error', message = 'Nevažeći podaci za bindovanje.' })
    end
end)

RegisterNUICallback('deleteEmoteBind', function(data, cb)
    local numkey = tonumber(data.key)
    if numkey then
        DeleteEmote({ tostring(numkey) })
        cb({ status = 'ok', message = 'Animacija obrisana sa slota '..numkey..'.' })
    else
        cb({ status = 'error', message = 'Nevažeći broj slota za brisanje.' })
    end
end)

RegisterNUICallback('resetSettings', function(_, cb)
    PlaySoundFrontend('SELECT', 'HUD_FRONTEND_DEFAULT_SOUNDSET')
    SimpleNotify(Translate('resetsettings'), "success")
    cb('ok')
end)

RegisterNUICallback('close', function(_, cb) CloseEmoteMenu(); cb('ok') end)

local function convertToEmoteData(emote)
    local arraySize=0;for i=1,4 do if emote[i]then arraySize=arraySize+1 end end
    if arraySize==1 then emote.anim=emote[1]
    elseif arraySize==2 then emote.anim,emote.label=emote[1],emote[2]
    elseif arraySize>=3 then
        local type=emote[1]
        if type==ScenarioType.MALE or type==ScenarioType.SCENARIO or type==ScenarioType.OBJECT then emote.scenario,emote.scenarioType=emote[2],type
        else emote.dict,emote.anim,emote.secondPlayersAnim=emote[1],emote[2],emote[4] end
        emote.label=emote[3]
    end
    local animOptions=emote.AnimationOptions
    if animOptions and not animOptions.onFootFlag then
        if animOptions.EmoteMoving then animOptions.onFootFlag=AnimFlag.MOVING
        elseif animOptions.EmoteLoop then animOptions.onFootFlag=AnimFlag.LOOP
        elseif animOptions.EmoteStuck then animOptions.onFootFlag=AnimFlag.STUCK end
    end
end

CreateThread(function()
    while RP==nil do Wait(500) end
    LoadAddonEmotes()
    local newRP={}
    for emoteType,content in pairs(RP)do
        for emoteName,emoteData in pairs(content)do
            if not(Config.AdultEmotesDisabled and emoteData.AdultAnimation)then
                newRP[emoteName]={}
                if type(emoteData)=="table"then for k,v in pairs(emoteData)do newRP[emoteName][k]=v end
                else newRP[emoteName]={emoteData}end
                newRP[emoteName].category=emoteType;convertToEmoteData(newRP[emoteName])
            end
        end
    end
    EmoteData=newRP

    local categorizedEmotes, allEmotes, addedEmotes = {}, {}, {}
    for name, data in pairs(EmoteData) do
        if type(data) == "table" and data.category then
            local options = data.AnimationOptions
            local canPosition = options and (options.onFootFlag == AnimFlag.STUCK or options.onFootFlag == AnimFlag.LOOP) or false
            local emoteForUI = { name = name, label = data.label or name, category = data.category, canPosition = canPosition }
            if not addedEmotes[name] then table.insert(allEmotes, emoteForUI); addedEmotes[name] = true end
            if not categorizedEmotes[data.category] then categorizedEmotes[data.category] = {} end
            table.insert(categorizedEmotes[data.category], emoteForUI)
        end
    end
    table.sort(allEmotes, function(a, b) return a.label < b.label end)
    for _, emotes in pairs(categorizedEmotes) do table.sort(emotes, function(a, b) return a.label < b.label end) end
    SendNUIMessage({ action = "loadEmotes", all = allEmotes, categories = categorizedEmotes })
end)

RegisterCommand('resetemotes', function()
    SendNUIMessage({
        action = 'resetSettings'
    })
end, false)
