import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  Easing,
} from "react-native";
import { useDrawer } from "../context/DrawerContext";
import { DrawerContent } from "./DrawerContent";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 310);

interface CustomDrawerProps {
  navigation?: any;
}

export const CustomDrawer: React.FC<CustomDrawerProps> = ({ navigation }) => {
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const [isRendered, setIsRendered] = useState(false);

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (isDrawerOpen) {
      setIsRendered(true);

      Animated.parallel([
        // Smooth slide-in with natural cubic bezier deceleration
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        // Smooth backdrop fade-in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Subtle depth scale transition
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isRendered) {
      // Smooth slide-out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 230,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: 250,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
        }
      });
    }
  }, [isDrawerOpen]);

  if (!isRendered) return null;

  return (
    <Modal
      transparent
      visible={isRendered}
      animationType="none"
      onRequestClose={closeDrawer}
      statusBarTranslucent
    >
      <View style={s.overlayContainer}>
        {/* Backdrop (Darkened overlay with fade animation) */}
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View
            style={[
              s.backdrop,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.6],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Animated Drawer Panel with smooth slide & scale */}
        <Animated.View
          style={[
            s.drawerPanel,
            {
              width: DRAWER_WIDTH,
              transform: [
                { translateX: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <DrawerContent navigation={navigation} onClose={closeDrawer} />
        </Animated.View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#050505",
  },
  drawerPanel: {
    height: "100%",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 24,
  },
});
