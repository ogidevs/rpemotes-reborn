-- =================================================================
-- FINAL LUA SCRIPT (V15 - True Sync, Correct Movement & Camera Toggle)
-- =================================================================

local isPositioningMode = false
local positioningCache = {}

local function startPositioningMode(name)
    local playerPed = PlayerPedId()
    local emoteData = EmoteData[name]
    if not emoteData then
        SimpleNotify(Translate('emote_data_not_found'), 'error')
        return false
    end

    if emoteData.category == "Walks" then
        SimpleNotify(Translate('cannot_adjust_walks'), 'error')
        return false
    end

    if emoteData.category == "Expressions" then
        SimpleNotify(Translate('cannot_adjust_expressions'), 'error')
        return false
    end
    
    if emoteData.category == "Shared" then
        SimpleNotify(Translate('cannot_adjust_shared'), 'error')
        return false
    end

    if not LocalPlayer.state.currentEmote or LocalPlayer.state.currentEmote ~= name then
        SimpleNotify(Translate('must_start_emote_first'), 'error')
        return false
    end

    local options = emoteData.AnimationOptions or {}
    if options.vehicleRequirement or IsPedInAnyVehicle(playerPed, false) then
        SimpleNotify(Translate('cannot_adjust_in_vehicle'), 'error')
        return false
    end

    if options.onFootFlag then
        local validFlags = { AnimFlag.STUCK, AnimFlag.LOOP }
        local canPosition = false
        for _, flag in ipairs(validFlags) do
            if options.onFootFlag == flag then
                canPosition = true
                break
            end
        end

        if not canPosition then
            SimpleNotify(Translate('cannot_adjust'), 'error')
            return false
        end
    end

    CloseEmoteMenu()
    positioningCache.coords = GetEntityCoords(playerPed)
    positioningCache.heading = GetEntityHeading(playerPed)
    FreezeEntityPosition(playerPed, true)
    SendNUIMessage({ action = "showReactGizmo", status = true })
    SetNuiFocus(true, true)
    isPositioningMode = true
    return true
end

local function RotateVector3D(vector, rotation)
    local radX, radY, radZ = math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z)
    local cosX, sinX = math.cos(radX), math.sin(radX)
    local cosY, sinY = math.cos(radY), math.sin(radY)
    local cosZ, sinZ = math.cos(radZ), math.sin(radZ)

    -- Apply rotation around Z-axis
    local x = vector.x * cosZ - vector.y * sinZ
    local y = vector.x * sinZ + vector.y * cosZ
    local z = vector.z

    -- Apply rotation around X-axis
    local tempY = y * cosX - z * sinX
    z = y * sinX + z * cosX
    y = tempY

    -- Apply rotation around Y-axis
    local tempX = x * cosY + z * sinY
    z = -x * sinY + z * cosY
    x = tempX

    return vector3(x, y, z)
end

local function EndPositioning(isSave)
    if not isPositioningMode then return end
    
    local playerPed = PlayerPedId()
    FreezeEntityPosition(playerPed, false)
    
    if isSave then
        TriggerServerEvent('rpemotes:server:syncPosition', positioningCache.lastTargetPosition, positioningCache.lastTargetHeading)
    else
        SetEntityCoordsNoOffset(playerPed, positioningCache.coords.x, positioningCache.coords.y, positioningCache.coords.z, true, true, true)
        SetEntityHeading(playerPed, positioningCache.heading)
        TriggerServerEvent('rpemotes:server:resetPosition', positioningCache.coords, positioningCache.heading)
    end

    isPositioningMode = false
    SendNUIMessage({ action = "showReactGizmo", status = false })
    SetNuiFocus(false, false)
    positioningCache = {}
end

RegisterNUICallback('playEmoteWithPositioning', function(data, cb)
    if not data.name or not data.category then return cb('error') end
    if LocalPlayer.state.currentEmote ~= data.name then
        EmoteMenuStart(data.name, data.category)
    end
    if not startPositioningMode(data.name) then return cb('error') end
    cb('ok')
end)


RegisterNUICallback('updatePedPositionFromUI', function(data, cb)
    if not isPositioningMode then return cb('error') end

    local playerPed = PlayerPedId()

    local camRot = GetGameplayCamRot(2)
    local camRight = RotateVector3D(vector3(1.0, 0.0, 0.0), camRot)
    local camForward = RotateVector3D(vector3(0.0, 1.0, 0.0), camRot)
    local camUp = RotateVector3D(vector3(0.0, 0.0, 1.0), camRot)

    local right = vector3(camRight.x, camRight.y, 0.0)
    local forward = vector3(camForward.x, camForward.y, 0.0)
    local up = camUp

    local flatForward = vector3(forward.x, forward.y, 0.0)
    if #(flatForward) > 0 then flatForward = norm(flatForward) end

    local rightMovement = right * data.x
    local forwardMovement = flatForward * data.y
    local upMovement = vector3(0.0, 0.0, 1.0) * data.z

    local targetPosition = positioningCache.coords + rightMovement + forwardMovement + upMovement
    local targetHeading = (positioningCache.heading + data.rotZ % 360 + 360) % 360

    local currentPos = GetEntityCoords(playerPed)
    local rayStart = currentPos + vector3(0.0, 0.0, 0.5) -- Počni raycast od centra tela
    local ray = StartShapeTestRay(rayStart, targetPosition + vector3(0.0, 0.0, 0.5), 10, playerPed, 7)
    local _, hasHit = GetShapeTestResult(ray)
    
    if not hasHit then
        if targetPosition.z >= positioningCache.coords.z then
            SetEntityCoordsNoOffset(playerPed, targetPosition.x, targetPosition.y, targetPosition.z, true, true, true)
            positioningCache.lastTargetPosition = targetPosition
            positioningCache.lastTargetHeading = targetHeading
        else
            SetEntityCoordsNoOffset(playerPed, targetPosition.x, targetPosition.y, positioningCache.coords.z, true, true, true)
            positioningCache.lastTargetPosition = vector3(targetPosition.x, targetPosition.y, positioningCache.coords.z)
            positioningCache.lastTargetHeading = targetHeading
        end
    end

    SetEntityHeading(playerPed, targetHeading)
    cb('ok')
end)

RegisterNUICallback('setCameraControl', function(data, cb)
    if not isPositioningMode then return cb('error') end
    SetNuiFocus(true, not data.status)
    cb('ok')
end)

RegisterNUICallback('savePositioning', function(_, cb) 
    EndPositioning(true)
    SimpleNotify(Translate('position_saved'), 'success')
    cb('ok') 
end)

RegisterNUICallback('cancelPositioning', function(_, cb) 
    EndPositioning(false)
    SimpleNotify(Translate('position_canc'), 'success')
    cb('ok') 
end)

-- Događaj koji server šalje SVIM klijentima
RegisterNetEvent('rpemotes:client:updatePlayerPosition', function(targetServerId, newCoords, newHeading)
    local localPlayerId = GetPlayerServerId(PlayerId())
    if targetServerId ~= localPlayerId then
        local targetPlayer = GetPlayerFromServerId(targetServerId)
        if targetPlayer ~= -1 and NetworkIsPlayerActive(targetPlayer) then
            local targetPed = GetPlayerPed(targetPlayer)
            if DoesEntityExist(targetPed) then
                SetEntityCoords(targetPed, newCoords.x, newCoords.y, newCoords.z, false, false, false, true)
                SetEntityHeading(targetPed, newHeading)
            end
        end
    end
end)

RegisterCommand('emotepos', function()
    local currentEmote = LocalPlayer.state.currentEmote
    if not currentEmote then
        SimpleNotify(Translate('must_start_emote_first'), 'error')
        return
    end
    startPositioningMode(currentEmote)
end, false)

RegisterKeyMapping('emotepos', Translate('emote_positioning_command'), 'keyboard', Config.EmotePositioningKeybind)

CreateThread(function()
    while true do
        if isPositioningMode then
            Wait(75)
            local ped = PlayerPedId()
            if DoesEntityExist(ped) then
                if not LocalPlayer.state.currentEmote then
                    EndPositioning(false)
                    SimpleNotify(Translate('animation_ended'), 'error')
                else
                    local camCoords = GetGameplayCamCoord()
                    local boneIndex = GetPedBoneIndex(ped, 31036) -- Pelvis
                    local boneCoords = GetPedBoneCoords(ped, boneIndex)
                    local onScreen, screenX, screenY = GetScreenCoordFromWorldCoord(boneCoords.x, boneCoords.y, boneCoords.z)
                    local distance = #(camCoords - boneCoords)
                    SendNUIMessage({ action = "updateGizmoPosition", onScreen = onScreen, screenX = screenX, screenY = screenY, camDist = distance })
                end
            else
                EndPositioning(false)
            end
        else
            Wait(800)
        end
    end
end)