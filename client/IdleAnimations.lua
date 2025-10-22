if Config.IdleAnimationsEnabled then
    local idleTimer = Config.IdleAnimationTimer or 10000
    local resetOnMovement = Config.ResetIdleOnMovement or true

    local isIdle = false

    Citizen.CreateThread(function()
        local lastPosition = GetEntityCoords(PlayerPedId())

        while true do
            if not CanDoAction() then
                Citizen.Wait(5000)
                goto continue
            end

            if IsPedInAnyVehicle(PlayerPedId()) then
                Citizen.Wait(5000)
                goto continue
            end
            Citizen.Wait(idleTimer)

            local playerPed = PlayerPedId()
            local currentPosition = GetEntityCoords(playerPed)
            local distanceMoved = #(currentPosition - lastPosition)

            if LocalPlayer.state.currentEmote == nil and isIdle then
                lastPosition = currentPosition
                isIdle = false
            end

            if distanceMoved > 0.1 then
                lastPosition = currentPosition
                if isIdle and resetOnMovement then
                    isIdle = false
                end
            else
                if not isIdle then
                    if #(GetEntityCoords(playerPed) - lastPosition) < 0.1 and CanPlayerIdle() then
                        isIdle = true
                        local idleEmote = Config.IdleAnimationsList[math.random(#Config.IdleAnimationsList)]
                        EmoteCancel(false)
                        OnEmotePlay(idleEmote)
                    end
                end
            end
            ::continue::
        end
    end)
end
